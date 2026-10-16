import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { accountSchema, type Account } from '../../lib/schemas';

export function useAccounts(uid: string | undefined) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', uid, 'accounts'),
      where('isArchived', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Account[] = [];
        snap.forEach((doc) => {
          const parsed = accountSchema.safeParse(doc.data());
          if (parsed.success) {
            list.push(parsed.data);
          }
        });
        setAccounts(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { accounts, loading, error };
}
