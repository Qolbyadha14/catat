import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { parseCategoryDoc, type Category } from '../../lib/schemas';
import { isShowcaseMode, MOCK_SHOWCASE_CATEGORIES } from '../../lib/showcaseMockData';

interface SnapshotState {
  key: string;
  categories: Category[];
  error: string | null;
}

const EMPTY: Category[] = [];

export function useCategories(uid: string, ledgerId?: string) {
  const showcase = isShowcaseMode();
  const key = ledgerId ?? `user:${uid}`;
  const [state, setState] = useState<SnapshotState>({ key: '', categories: EMPTY, error: null });

  useEffect(() => {
    if (showcase || (!uid && !ledgerId)) return;
    const colRef = ledgerId
      ? collection(db, 'ledgers', ledgerId, 'categories')
      : collection(db, 'users', uid, 'categories');

    return onSnapshot(
      query(colRef),
      (snap) => {
        const list: Category[] = [];
        snap.forEach((docSnap) => {
          const parsed = parseCategoryDoc(docSnap.data());
          if (parsed.success) list.push(parsed.data);
        });
        setState({ key, categories: list, error: null });
      },
      (err) => setState({ key, categories: EMPTY, error: err.message })
    );
  }, [showcase, uid, ledgerId, key]);

  if (showcase) return { categories: MOCK_SHOWCASE_CATEGORIES, loading: false, error: null };

  // Saat berpindah buku kas, data buku kas sebelumnya tidak ditampilkan
  const isCurrent = state.key === key;
  return {
    categories: isCurrent ? state.categories : EMPTY,
    loading: !isCurrent,
    error: isCurrent ? state.error : null,
  };
}
