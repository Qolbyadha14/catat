import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { transactionSchema, type Transaction } from '../../lib/schemas';
import { isShowcaseMode } from '../../lib/showcaseMockData';
import type { TransactionRange } from '../../lib/transactionRange';

export function transactionsCollection(uid: string, ledgerId?: string) {
  return ledgerId
    ? collection(db, 'ledgers', ledgerId, 'transactions')
    : collection(db, 'users', uid, 'transactions');
}

/**
 * Semua transaksi dengan date di [range.start, range.end), terbaru dulu.
 * Range dan orderBy pada field yang sama memakai single-field index otomatis.
 */
export function transactionsInRangeQuery(uid: string, range: TransactionRange, ledgerId?: string) {
  return query(
    transactionsCollection(uid, ledgerId),
    where('date', '>=', range.start),
    where('date', '<', range.end),
    orderBy('date', 'desc')
  );
}

export function parseTransactionDocs(docs: QueryDocumentSnapshot[]): Transaction[] {
  const list: Transaction[] = [];
  for (const snapshot of docs) {
    const parsed = transactionSchema.safeParse(snapshot.data());
    if (parsed.success) list.push(parsed.data);
  }
  return list;
}

/**
 * Transaksi terbaru lintas bulan, maksimal `max`. Dipakai pencarian "Semua riwayat".
 * Mengambil satu dokumen ekstra untuk mengetahui apakah hasilnya terpotong.
 * Tanpa filter, hanya orderBy('date'), jadi cukup single-field index otomatis.
 */
export async function fetchRecentTransactions(
  uid: string,
  max: number,
  ledgerId?: string
): Promise<{ transactions: Transaction[]; truncated: boolean }> {
  const snap = await getDocs(
    query(transactionsCollection(uid, ledgerId), orderBy('date', 'desc'), limit(max + 1))
  );
  const truncated = snap.size > max;
  return { transactions: parseTransactionDocs(truncated ? snap.docs.slice(0, max) : snap.docs), truncated };
}

/**
 * Mencari struk yang sudah pernah dicatat di seluruh riwayat, bukan hanya bulan yang sedang dimuat.
 */
export async function findTransactionByReferenceKey(
  uid: string,
  referenceKey: string | null | undefined,
  ledgerId?: string
): Promise<Transaction | null> {
  const key = referenceKey?.trim();
  if (!key || isShowcaseMode()) return null;
  const snap = await getDocs(
    query(transactionsCollection(uid, ledgerId), where('referenceKey', '==', key), limit(1))
  );
  return parseTransactionDocs(snap.docs)[0] ?? null;
}
