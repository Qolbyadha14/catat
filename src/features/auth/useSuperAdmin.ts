import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isShowcaseMode } from '../../lib/showcaseMockData';

export interface SuperAdminState {
  isSuperAdmin: boolean;
  loading: boolean;
}

const KNOWN_ADMIN_EMAILS = new Set([
  'qolbyadha04@gmail.com',
]);


export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return KNOWN_ADMIN_EMAILS.has(email.toLowerCase().trim());
}

export function useSuperAdmin(uid?: string | null, email?: string | null): SuperAdminState {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isShowcaseMode()) {
      setIsSuperAdmin(true);
      setLoading(false);
      return;
    }

    if (!uid) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    // Fast-path email check
    if (isSuperAdminEmail(email)) {
      setIsSuperAdmin(true);
      setLoading(false);
      return;
    }

    // Check system_admins/{uid} in Firestore
    const adminRef = doc(db, 'system_admins', uid);
    const unsubscribe = onSnapshot(
      adminRef,
      (snap) => {
        setIsSuperAdmin(snap.exists());
        setLoading(false);
      },
      (_error) => {
        // Fallback to email check if Firestore listener errors
        setIsSuperAdmin(isSuperAdminEmail(email));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid, email]);

  return { isSuperAdmin, loading };
}

