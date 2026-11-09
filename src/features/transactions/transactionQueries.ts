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
