import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { transactionSchema, type Transaction } from '../../lib/schemas';
import { isShowcaseMode, MOCK_SHOWCASE_TRANSACTIONS } from '../../lib/showcaseMockData';

export function useTransactions(uid: string, maxItems: number = 50, ledgerId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isShowcaseMode()) {
      setTransactions(MOCK_SHOWCASE_TRANSACTIONS);
      setLoading(false);
      return;
    }

    if (!uid && !ledgerId) return;

    const colRef = ledgerId
      ? collection(db, 'ledgers', ledgerId, 'transactions')
      : collection(db, 'users', uid, 'transactions');
    const q = query(
      colRef,
      orderBy('date', 'desc'),
      limit(maxItems)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((doc) => {
          const parsed = transactionSchema.safeParse(doc.data());
          if (parsed.success) {
            list.push(parsed.data);
          }
        });
        setTransactions(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid, maxItems, ledgerId]);

  return { transactions, loading, error };
}
