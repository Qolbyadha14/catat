import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  startAfter,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { omitUndefinedDeep } from '../../lib/omitUndefined';
import {
  accountSchema,
  parseCategoryDoc,
  transactionSchema,
  type Account,
  type Category,
  type Transaction,
} from '../../lib/schemas';
import { buildBackup, type Backup } from './backupFormat';
import {
  aggregateBalanceDeltas,
  chunkTransactionsForWrite,
  type ExistingIds,
  type RestorePlan,
} from './restorePlan';

/** Batas pengaman; lebih dari ini ekspor dihentikan, bukan dipotong diam-diam. */
export const MAX_BACKUP_DOCS = 50_000;
const PAGE_SIZE = 500;
/** Batas operasi per batch Firestore adalah 500; sisakan ruang. */
export const DEFAULT_WRITE_CHUNK = 400;

export class BackupTooLargeError extends Error {
  constructor() {
    super(`Data terlalu besar untuk dicadangkan sekaligus (lebih dari ${MAX_BACKUP_DOCS.toLocaleString('id-ID')} transaksi).`);
    this.name = 'BackupTooLargeError';
  }
}

function collections(uid: string, ledgerId?: string) {
  const root = ledgerId ? (['ledgers', ledgerId] as const) : (['users', uid] as const);
  return {
    accounts: collection(db, root[0], root[1], 'accounts'),
    categories: collection(db, root[0], root[1], 'categories'),
    transactions: collection(db, root[0], root[1], 'transactions'),
  };
}

/** Membaca seluruh dokumen koleksi per halaman. Gagal bila melebihi batas, tidak memotong. */
async function readAllDocs(col: CollectionReference<DocumentData>): Promise<QueryDocumentSnapshot[]> {
  const all: QueryDocumentSnapshot[] = [];
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    const snap = await getDocs(
      last
        ? query(col, orderBy('date'), startAfter(last), limit(PAGE_SIZE))
        : query(col, orderBy('date'), limit(PAGE_SIZE))
    );
    all.push(...snap.docs);
    if (all.length > MAX_BACKUP_DOCS) throw new BackupTooLargeError();
    if (snap.size < PAGE_SIZE) return all;
    last = snap.docs[snap.docs.length - 1];
  }
}

async function readSmallCollection(col: CollectionReference<DocumentData>): Promise<QueryDocumentSnapshot[]> {
  return (await getDocs(col)).docs;
}

export interface ExportResult {
  backup: Backup;
  /** Dokumen yang gagal validasi sehingga tidak ikut tercadangkan. */
  skippedInvalid: number;
}

export async function exportBackup(
  uid: string,
  scope: { ledgerId?: string; name: string }
): Promise<ExportResult> {
  const cols = collections(uid, scope.ledgerId);
  const [accountDocs, categoryDocs, txDocs] = await Promise.all([
    readSmallCollection(cols.accounts),
    readSmallCollection(cols.categories),
    readAllDocs(cols.transactions),
  ]);

  const accounts: Account[] = [];
  const categories: Category[] = [];
  const transactions: Transaction[] = [];
  let skippedInvalid = 0;

  for (const d of accountDocs) {
    const r = accountSchema.safeParse(d.data());
    if (r.success) accounts.push(r.data);
    else skippedInvalid++;
  }
  for (const d of categoryDocs) {
    const r = parseCategoryDoc(d.data());
    if (r.success) categories.push(r.data);
    else skippedInvalid++;
  }
  for (const d of txDocs) {
    const r = transactionSchema.safeParse(d.data());
    if (r.success) transactions.push(r.data);
    else skippedInvalid++;
  }

  return {
    backup: buildBackup({
      scope: scope.ledgerId ? 'family' : 'personal',
      scopeName: scope.name,
      accounts,
      categories,
      transactions,
    }),
    skippedInvalid,
  };
}

/** ID dokumen yang sudah ada, dipakai untuk memastikan restore tidak menimpa apa pun. */
export async function loadExistingIds(uid: string, ledgerId?: string): Promise<ExistingIds> {
  const cols = collections(uid, ledgerId);
  const [accountDocs, categoryDocs, txDocs] = await Promise.all([
    readSmallCollection(cols.accounts),
    readSmallCollection(cols.categories),
    readAllDocs(cols.transactions),
  ]);
  return {
    accountIds: new Set(accountDocs.map((d) => d.id)),
    categoryIds: new Set(categoryDocs.map((d) => d.id)),
    transactionIds: new Set(txDocs.map((d) => d.id)),
  };
}

export interface ApplyProgress {
  written: number;
  total: number;
}

/**
 * Menulis rencana restore per batch. Tiap batch konsisten sendiri: transaksi di dalamnya
 * beserta pergeseran saldo akunnya ada di batch yang sama. Bila terputus di tengah,
 * menjalankan ulang (rencana dihitung ulang dari data terbaru) melanjutkan dari sisa
 * tanpa menghitung dua kali.
 */
export async function applyRestorePlan(
  uid: string,
  ledgerId: string | undefined,
  plan: RestorePlan,
  options: { chunkSize?: number; onProgress?: (progress: ApplyProgress) => void } = {}
): Promise<void> {
  const chunkSize = Math.min(Math.max(options.chunkSize ?? DEFAULT_WRITE_CHUNK, 4), DEFAULT_WRITE_CHUNK);
  const cols = collections(uid, ledgerId);
  const total = plan.accountsToCreate.length + plan.categoriesToCreate.length + plan.transactionsToCreate.length;
  let written = 0;
  const report = (n: number) => {
    written += n;
    options.onProgress?.({ written, total });
  };

  // 1. Akun dan kategori
  const setupOps: Array<{ ref: ReturnType<typeof doc>; data: DocumentData }> = [
    ...plan.accountsToCreate.map((a) => ({ ref: doc(cols.accounts, a.id), data: omitUndefinedDeep(a) })),
    ...plan.categoriesToCreate.map((c) => ({ ref: doc(cols.categories, c.id), data: omitUndefinedDeep(c) })),
  ];
  for (let i = 0; i < setupOps.length; i += chunkSize) {
    const slice = setupOps.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const op of slice) batch.set(op.ref, op.data);
    await batch.commit();
    report(slice.length);
  }

  // 2. Transaksi, masing-masing kelompok bersama pergeseran saldonya
  for (const chunk of chunkTransactionsForWrite(plan.transactionsToCreate, chunkSize)) {
    const batch = writeBatch(db);
    for (const tx of chunk) batch.set(doc(cols.transactions, tx.id), omitUndefinedDeep(tx));
    for (const [accountId, delta] of aggregateBalanceDeltas(chunk)) {
      batch.update(doc(cols.accounts, accountId), { balance: increment(delta) });
    }
    await batch.commit();
    report(chunk.length);
  }
}
