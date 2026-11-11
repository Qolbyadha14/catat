import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isShowcaseMode } from '../../lib/showcaseMockData';

export interface SuperAdminState {
  isSuperAdmin: boolean;
  loading: boolean;
}

interface AdminSnapshot {
  uid: string | null;
  isSuperAdmin: boolean;
}

/**
 * Satu-satunya sumber status admin adalah dokumen system_admins/{uid},
 * sama dengan yang diperiksa isSuperAdmin() di firestore.rules.
 * Rules hanya mengizinkan tiap user membaca dokumen miliknya sendiri.
 */
export function useSuperAdmin(uid?: string | null): SuperAdminState {
  const showcase = isShowcaseMode();
  const [snapshot, setSnapshot] = useState<AdminSnapshot>({ uid: null, isSuperAdmin: false });

  useEffect(() => {
    if (showcase || !uid) return;
    return onSnapshot(
      doc(db, 'system_admins', uid),
      (snap) => setSnapshot({ uid, isSuperAdmin: snap.exists() }),
      () => setSnapshot({ uid, isSuperAdmin: false })
    );
  }, [showcase, uid]);

  if (showcase) return { isSuperAdmin: true, loading: false };
  if (!uid) return { isSuperAdmin: false, loading: false };

  const isCurrent = snapshot.uid === uid;
  return { isSuperAdmin: isCurrent && snapshot.isSuperAdmin, loading: !isCurrent };
}
