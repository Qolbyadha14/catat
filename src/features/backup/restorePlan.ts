import type { Account, Category, Creator, Transaction } from '../../lib/schemas';
import type { ParsedBackup } from './backupFormat';

export interface ExistingIds {
  accountIds: ReadonlySet<string>;
  categoryIds: ReadonlySet<string>;
  transactionIds: ReadonlySet<string>;
}

export interface RestorePlan {
  /** Akun yang belum ada; `balance` sudah berupa saldo awal (lihat planRestore). */
  accountsToCreate: Account[];
  categoriesToCreate: Category[];
  /** Terlama dulu. Tiap transaksi menggeser saldo akunnya saat diterapkan. */
  transactionsToCreate: Transaction[];
  skipped: {
    /** ID sudah ada di data sekarang, atau muncul ganda di file. */
    existing: number;
    /** Akun atau kategori yang dirujuk tidak ada di data sekarang maupun di file. */
    missingRefs: number;
    /** Item rusak di file (gagal validasi). */
    invalid: number;
  };
  /** Transaksi milik anggota lain yang dicatat ulang atas nama pemulih (rules mewajibkan penulis = pembuat). */
  reattributed: number;
}

/** Perubahan saldo akibat satu transaksi; sama dengan yang dilakukan transactionService. */
export function transactionBalanceEffects(tx: Transaction): Array<[accountId: string, delta: number]> {
  if (tx.type === 'transfer') {
    return [
      [tx.fromAccountId, -tx.amount],
      [tx.toAccountId, tx.amount],
    ];
  }
  return [[tx.accountId, tx.type === 'income' ? tx.amount : -tx.amount]];
}

/** Total perubahan saldo per akun untuk sekumpulan transaksi; akun dengan total 0 tidak disertakan. */
export function aggregateBalanceDeltas(transactions: readonly Transaction[]): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const tx of transactions) {
    for (const [accountId, delta] of transactionBalanceEffects(tx)) {
      deltas.set(accountId, (deltas.get(accountId) ?? 0) + delta);
    }
  }
  for (const [accountId, delta] of deltas) if (delta === 0) deltas.delete(accountId);
  return deltas;
}

/**
 * Menyusun apa yang akan ditulis saat memulihkan. Prinsip:
 * - Dokumen yang sudah ada tidak pernah ditimpa; yang sudah ada dilewati.
 * - Akun baru dibuat dengan saldo awal = saldo di backup dikurangi pengaruh semua transaksi backup pada akun itu.
 *   Setelah transaksinya dipulihkan (masing-masing menggeser saldo), saldo akhir sama dengan saldo di backup,
 *   dan saldo awal (opening balance yang tidak berasal dari transaksi) tetap terjaga.
 * - Akun yang sudah ada hanya digeser oleh transaksi yang benar-benar baru ditambahkan.
 */
export function planRestore(backup: ParsedBackup, existing: ExistingIds, me: Creator): RestorePlan {
  const effectPerAccount = aggregateBalanceDeltas(backup.transactions);

  const categoriesToCreate = backup.categories.filter((c) => !existing.categoryIds.has(c.id));
  const accountsToCreate = backup.accounts
    .filter((a) => !existing.accountIds.has(a.id))
    .map((a) => ({ ...a, balance: a.balance - (effectPerAccount.get(a.id) ?? 0) }));

  const knownAccounts = new Set<string>([...existing.accountIds, ...accountsToCreate.map((a) => a.id)]);
  const knownCategories = new Set<string>([...existing.categoryIds, ...categoriesToCreate.map((c) => c.id)]);

  const skipped = { existing: 0, missingRefs: 0, invalid: backup.invalid.accounts + backup.invalid.categories + backup.invalid.transactions };
  const seen = new Set<string>();
  const transactionsToCreate: Transaction[] = [];
  let reattributed = 0;

  const ordered = [...backup.transactions].sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
  for (const tx of ordered) {
    if (existing.transactionIds.has(tx.id) || seen.has(tx.id)) {
      skipped.existing++;
      continue;
    }
    seen.add(tx.id);

    const accountsOk = transactionBalanceEffects(tx).every(([id]) => knownAccounts.has(id));
    const categoryOk = tx.type === 'transfer' || knownCategories.has(tx.categoryId);
    if (!accountsOk || !categoryOk) {
      skipped.missingRefs++;
      continue;
    }

    if (tx.createdBy && tx.createdBy.uid !== me.uid) {
      reattributed++;
      const createdBy: Creator = { uid: me.uid, name: me.name };
      if (me.photoURL) createdBy.photoURL = me.photoURL;
      transactionsToCreate.push({ ...tx, createdBy });
    } else {
      transactionsToCreate.push(tx);
    }
  }

  return { accountsToCreate, categoriesToCreate, transactionsToCreate, skipped, reattributed };
}

/**
 * Memecah transaksi menjadi kelompok yang tiap kelompoknya muat dalam satu batch tulis:
 * satu operasi per transaksi ditambah satu per akun berbeda yang saldonya digeser.
 * Urutan dipertahankan; kelompok minimal berisi satu transaksi.
 */
export function chunkTransactionsForWrite(transactions: readonly Transaction[], maxOps: number): Transaction[][] {
  const chunks: Transaction[][] = [];
  let current: Transaction[] = [];
  let accounts = new Set<string>();
  for (const tx of transactions) {
    const nextAccounts = new Set(accounts);
    for (const [id] of transactionBalanceEffects(tx)) nextAccounts.add(id);
    if (current.length > 0 && current.length + 1 + nextAccounts.size > maxOps) {
      chunks.push(current);
      current = [];
      accounts = new Set();
      for (const [id] of transactionBalanceEffects(tx)) accounts.add(id);
    } else {
      accounts = nextAccounts;
    }
    current.push(tx);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function isPlanEmpty(plan: RestorePlan): boolean {
  return (
    plan.accountsToCreate.length === 0 &&
    plan.categoriesToCreate.length === 0 &&
    plan.transactionsToCreate.length === 0
  );
}
