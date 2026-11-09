import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import type { Transaction } from '../../lib/schemas';
import { isShowcaseMode, MOCK_SHOWCASE_TRANSACTIONS } from '../../lib/showcaseMockData';
import { filterTransactionsInRange, type TransactionRange } from '../../lib/transactionRange';
import { parseTransactionDocs, transactionsInRangeQuery } from './transactionQueries';

interface SnapshotState {
  key: string;
  transactions: Transaction[];
  error: string | null;
}

const EMPTY_STATE: SnapshotState = { key: '', transactions: [], error: null };

/**
 * Subscribes to every transaction in [range.start, range.end).
 * Tidak ada batas jumlah: total bulanan, anggaran, statistik, dan export harus melihat seluruh rentang.
 * Listener dengan query yang sama dibagi oleh Firestore SDK, jadi pemakaian ganda tidak menambah biaya baca.
 */
export function useTransactions(uid: string, range: TransactionRange, ledgerId?: string) {
  const { start, end } = range;
  const showcase = isShowcaseMode();
  const key = `${ledgerId ?? `user:${uid}`}|${start}|${end}`;
  const [state, setState] = useState<SnapshotState>(EMPTY_STATE);

  useEffect(() => {
    if (showcase || (!uid && !ledgerId)) return;
    return onSnapshot(
      transactionsInRangeQuery(uid, { start, end }, ledgerId),
      (snap) => setState({ key, transactions: parseTransactionDocs(snap.docs), error: null }),
      (err) => setState({ key, transactions: [], error: err.message })
    );
  }, [showcase, uid, ledgerId, start, end, key]);

  const showcaseTransactions = useMemo(
    () => (showcase ? filterTransactionsInRange(MOCK_SHOWCASE_TRANSACTIONS, { start, end }) : EMPTY_STATE.transactions),
    [showcase, start, end]
  );

  if (showcase) {
    return { transactions: showcaseTransactions, loading: false, error: null };
  }

  // Data bulan sebelumnya tidak ditampilkan saat bulan berganti; loading sampai snapshot bulan baru tiba
  const isCurrent = state.key === key;
  return {
    transactions: isCurrent ? state.transactions : EMPTY_STATE.transactions,
    loading: !isCurrent,
    error: isCurrent ? state.error : null,
  };
}
