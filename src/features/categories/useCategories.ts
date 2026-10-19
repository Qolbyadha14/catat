import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { categorySchema, type Category } from '../../lib/schemas';

export function useCategories(uid: string, ledgerId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid && !ledgerId) return;

    const colRef = ledgerId
      ? collection(db, 'ledgers', ledgerId, 'categories')
      : collection(db, 'users', uid, 'categories');
    const q = query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Category[] = [];
        snap.forEach((doc) => {
          const parsed = categorySchema.safeParse(doc.data());
          if (parsed.success) {
            list.push(parsed.data);
          }
        });
        setCategories(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid, ledgerId]);

  return { categories, loading, error };
}
