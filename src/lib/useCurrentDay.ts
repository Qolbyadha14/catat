import { useEffect, useState } from 'react';
import { startOfLocalDay } from './transactionGroups';

/**
 * Awal hari ini (00:00 lokal). Berganti sendiri saat lewat tengah malam, dan saat tab kembali aktif
 * (timer dibekukan browser ketika perangkat tidur), sehingga label "Hari ini" tidak basi.
 */
export function useCurrentDay(): number {
  const [day, setDay] = useState(() => startOfLocalDay(Date.now()));

  useEffect(() => {
    const sync = () => setDay((prev) => {
      const now = startOfLocalDay(Date.now());
      return now === prev ? prev : now;
    });

    const nextMidnight = new Date(day);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    const timer = setTimeout(sync, Math.max(1000, nextMidnight.getTime() - Date.now() + 1000));

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [day]);

  return day;
}
