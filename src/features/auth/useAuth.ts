import { useEffect, useState } from 'react';
import {
  type User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { ensureUserDefaults } from './seedDefaults';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (currentUser) {
          try {
            await ensureUserDefaults(currentUser.uid);
            setUser(currentUser);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Gagal inisialisasi data pengguna';
            setError(msg);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      await ensureUserDefaults(res.user.uid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google';
      setError(msg);
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await fbSignOut(auth);
      setUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal keluar akun';
      setError(msg);
      throw err;
    }
  };

  return { user, loading, error, signInWithGoogle, signOut };
}
