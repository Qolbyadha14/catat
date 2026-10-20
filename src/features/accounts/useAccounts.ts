import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { accountSchema, type Account } from '../../lib/schemas';
import { isShowcaseMode, MOCK_SHOWCASE_ACCOUNTS } from '../../lib/showcaseMockData';

export function useAccounts(uid: string, ledgerId?: string) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isShowcaseMode()) {
      setAccounts(MOCK_SHOWCASE_ACCOUNTS);
      setLoading(false);
      return;
    }

    if (!uid && !ledgerId) return;

    const colRef = ledgerId
      ? collection(db, 'ledgers', ledgerId, 'accounts')
      : collection(db, 'users', uid, 'accounts');
    const q = query(colRef);

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
  }, [uid, ledgerId]);

  return { accounts, loading, error };
}
