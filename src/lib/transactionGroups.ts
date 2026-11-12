import type { Transaction } from './schemas';

export interface DayGroup {
  /** YYYY-MM-DD (waktu lokal); stabil untuk dipakai sebagai React key dan id elemen. */
  key: string;
  /** "Hari ini", "Kemarin", atau "Senin, 3 November" (+ tahun bila bukan tahun berjalan). */
  label: string;
  /** Awal hari (00:00 lokal) dalam epoch ms. */
  dayStart: number;
  /** Total pemasukan hari itu; transfer tidak dihitung. */
  income: number;
  /** Total pengeluaran hari itu; transfer tidak dihitung. */
  expense: number;
  /** Terbaru dulu. */
  transactions: Transaction[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const sameYearFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
const otherYearFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function formatDayLabel(dayStart: number, todayStart: number): string {
  if (dayStart === todayStart) return 'Hari ini';
  // setDate (bukan dikurangi 24 jam) agar tetap benar saat pergantian waktu musim panas
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayStart === yesterday.getTime()) return 'Kemarin';
  const sameYear = new Date(dayStart).getFullYear() === new Date(todayStart).getFullYear();
  return (sameYear ? sameYearFormat : otherYearFormat).format(new Date(dayStart));
}

/**
 * Mengelompokkan transaksi per hari (waktu lokal), terbaru dulu, lengkap dengan subtotal harian.
 * `todayStart` diberikan pemanggil agar fungsi ini tetap murni dan mudah dites.
 */
export function groupTransactionsByDay(transactions: readonly Transaction[], todayStart: number): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const tx of [...transactions].sort((a, b) => b.date - a.date)) {
    const dayStart = startOfLocalDay(tx.date);
    const d = new Date(dayStart);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let group = groups.get(key);
    if (!group) {
      group = { key, label: formatDayLabel(dayStart, todayStart), dayStart, income: 0, expense: 0, transactions: [] };
      groups.set(key, group);
    }
    group.transactions.push(tx);
    if (tx.type === 'income') group.income += tx.amount;
    else if (tx.type === 'expense') group.expense += tx.amount;
  }
  return [...groups.values()];
}
