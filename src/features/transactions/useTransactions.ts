import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { transactionSchema, type Transaction } from '../../lib/schemas';

export function useTransactions(uid: string, maxItems: number = 50) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'users', uid, 'transactions'),
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
  }, [uid, maxItems]);

  return { transactions, loading, error };
}
