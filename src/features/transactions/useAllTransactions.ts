import { useEffect, useState } from 'react';
import type { Transaction } from '../../lib/schemas';
import { isShowcaseMode, MOCK_SHOWCASE_TRANSACTIONS } from '../../lib/showcaseMockData';
import { fetchRecentTransactions } from './transactionQueries';

/** Batas dokumen yang diambil sekali jalan; cukup untuk bertahun-tahun pencatatan harian. */
export const MAX_SEARCH_TRANSACTIONS = 2000;

/** Data yang masih segar tidak diambil ulang saat pencarian dibuka lagi. */
const FRESH_MS = 60_000;

interface Loaded {
  key: string;
  transactions: Transaction[];
  truncated: boolean;
  error: string | null;
  fetchedAt: number;
}

/**
 * Mengambil riwayat transaksi lintas bulan hanya saat `enabled` (pencarian "Semua riwayat" aktif).
 * Hasil lama tetap ditampilkan selama pengambilan ulang berjalan.
 */
export function useAllTransactions(uid: string, ledgerId: string | undefined, enabled: boolean) {
  const showcase = isShowcaseMode();
  const key = ledgerId ?? `user:${uid}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (showcase || !enabled || (!uid && !ledgerId)) return;
    if (loaded && loaded.key === key && !loaded.error && Date.now() - loaded.fetchedAt < FRESH_MS) return;

    let cancelled = false;
    fetchRecentTransactions(uid, MAX_SEARCH_TRANSACTIONS, ledgerId)
      .then(({ transactions, truncated }) => {
        if (!cancelled) setLoaded({ key, transactions, truncated, error: null, fetchedAt: Date.now() });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            key,
            transactions: [],
            truncated: false,
            error: err instanceof Error ? err.message : 'Gagal memuat riwayat',
            fetchedAt: Date.now(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // `loaded` sengaja tidak jadi dependency: efek ini hanya dijalankan ulang saat pencarian dibuka
    // atau buku kas berganti. Memasukkannya akan memicu pengambilan ulang setelah tiap hasil tiba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcase, enabled, uid, ledgerId, key]);

  if (showcase) {
    return { transactions: MOCK_SHOWCASE_TRANSACTIONS, truncated: false, loading: false, error: null };
  }

  const isCurrent = loaded !== null && loaded.key === key;
  return {
    transactions: isCurrent ? loaded.transactions : [],
    truncated: isCurrent ? loaded.truncated : false,
    loading: enabled && !isCurrent,
    error: isCurrent ? loaded.error : null,
  };
}
