import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { accountSchema, type Account } from '../../lib/schemas';
import { isShowcaseMode, MOCK_SHOWCASE_ACCOUNTS } from '../../lib/showcaseMockData';

interface SnapshotState {
  key: string;
  accounts: Account[];
  error: string | null;
}

const EMPTY: Account[] = [];

export function useAccounts(uid: string, ledgerId?: string) {
  const showcase = isShowcaseMode();
  const key = ledgerId ?? `user:${uid}`;
  const [state, setState] = useState<SnapshotState>({ key: '', accounts: EMPTY, error: null });

  useEffect(() => {
    if (showcase || (!uid && !ledgerId)) return;
    const colRef = ledgerId
      ? collection(db, 'ledgers', ledgerId, 'accounts')
      : collection(db, 'users', uid, 'accounts');

    return onSnapshot(
      query(colRef),
      (snap) => {
        const list: Account[] = [];
        snap.forEach((docSnap) => {
          const parsed = accountSchema.safeParse(docSnap.data());
          if (parsed.success) list.push(parsed.data);
        });
        setState({ key, accounts: list, error: null });
      },
      (err) => setState({ key, accounts: EMPTY, error: err.message })
    );
  }, [showcase, uid, ledgerId, key]);

  if (showcase) return { accounts: MOCK_SHOWCASE_ACCOUNTS, loading: false, error: null };

  // Saat berpindah buku kas, saldo buku kas sebelumnya tidak ditampilkan
  const isCurrent = state.key === key;
  return {
    accounts: isCurrent ? state.accounts : EMPTY,
    loading: !isCurrent,
    error: isCurrent ? state.error : null,
  };
}
