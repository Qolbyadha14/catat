import { describe, expect, test } from 'bun:test';
import type { Transaction } from './schemas';
import { formatDayLabel, groupTransactionsByDay, startOfLocalDay } from './transactionGroups';

const base = { createdAt: 1, updatedAt: 1, note: '', accountId: 'acc', categoryId: 'cat' };
const tx = (id: string, type: 'income' | 'expense' | 'transfer', amount: number, date: number) =>
  (type === 'transfer'
    ? { ...base, id, type, amount, date, fromAccountId: 'a', toAccountId: 'b' }
    : { ...base, id, type, amount, date }) as Transaction;

// Kamis, 12 November 2026
const today = new Date(2026, 10, 12, 15, 30).getTime();
const todayStart = startOfLocalDay(today);
const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0, ms = 0) => new Date(y, m, d, h, min, s, ms).getTime();

describe('formatDayLabel', () => {
  test('hari ini dan kemarin', () => {
    expect(formatDayLabel(todayStart, todayStart)).toBe('Hari ini');
    expect(formatDayLabel(startOfLocalDay(at(2026, 10, 11)), todayStart)).toBe('Kemarin');
  });

  test('hari lain di tahun yang sama tanpa tahun, dengan nama hari', () => {
    const label = formatDayLabel(startOfLocalDay(at(2026, 10, 3)), todayStart);
    expect(label).toBe(new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(2026, 10, 3)));
    expect(label).toContain('3');
    expect(label).not.toContain('2026');
    expect(label.toLowerCase()).toContain('selasa');
  });

  test('tahun berbeda menyertakan tahun', () => {
    expect(formatDayLabel(startOfLocalDay(at(2025, 11, 28)), todayStart)).toContain('2025');
  });

  test('"kemarin" tetap benar melintasi batas bulan dan tahun', () => {
    const jan1 = startOfLocalDay(at(2027, 0, 1));
    expect(formatDayLabel(startOfLocalDay(at(2026, 11, 31)), jan1)).toBe('Kemarin');
  });
});

describe('groupTransactionsByDay', () => {
  test('input kosong menghasilkan array kosong', () => {
    expect(groupTransactionsByDay([], todayStart)).toEqual([]);
  });

  test('mengelompokkan per hari, terbaru dulu, walau input tidak berurutan', () => {
    const groups = groupTransactionsByDay(
      [tx('old', 'expense', 100, at(2026, 10, 3)), tx('t1', 'expense', 200, at(2026, 10, 12, 8)), tx('y1', 'income', 300, at(2026, 10, 11)), tx('t2', 'expense', 400, at(2026, 10, 12, 20))],
      todayStart
    );
    expect(groups.map((g) => g.label)).toEqual(['Hari ini', 'Kemarin', groups[2]!.label]);
    expect(groups.map((g) => g.key)).toEqual(['2026-11-12', '2026-11-11', '2026-11-03']);
    expect(groups[0]!.transactions.map((t) => t.id)).toEqual(['t2', 't1']);
  });

  test('subtotal memisahkan pemasukan dan pengeluaran, transfer tidak dihitung', () => {
    const [group] = groupTransactionsByDay(
      [tx('a', 'expense', 25000, at(2026, 10, 12, 9)), tx('b', 'expense', 15000, at(2026, 10, 12, 10)), tx('c', 'income', 1000000, at(2026, 10, 12, 11)), tx('d', 'transfer', 500000, at(2026, 10, 12, 12))],
      todayStart
    );
    expect(group).toMatchObject({ income: 1000000, expense: 40000 });
    expect(group!.transactions).toHaveLength(4);
  });

  test('batas hari: 23:59:59.999 dan 00:00:00.000 jatuh ke hari yang benar', () => {
    const groups = groupTransactionsByDay(
      [tx('late', 'expense', 1, at(2026, 10, 11, 23, 59, 59, 999)), tx('early', 'expense', 1, at(2026, 10, 12, 0, 0, 0, 0))],
      todayStart
    );
    expect(groups.map((g) => [g.key, g.transactions.map((t) => t.id)])).toEqual([
      ['2026-11-12', ['early']],
      ['2026-11-11', ['late']],
    ]);
  });

  test('tidak mengubah array asli', () => {
    const input = [tx('a', 'expense', 1, at(2026, 10, 3)), tx('b', 'expense', 1, at(2026, 10, 12))];
    groupTransactionsByDay(input, todayStart);
    expect(input.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('transaksi lintas tahun: Hari ini, Kemarin, lalu hari lama dengan tahun', () => {
    const groups = groupTransactionsByDay(
      [tx('a', 'expense', 1, at(2025, 11, 20)), tx('b', 'expense', 1, at(2025, 11, 31)), tx('c', 'expense', 1, at(2026, 0, 1))],
      startOfLocalDay(at(2026, 0, 1))
    );
    expect(groups.map((g) => g.label.slice(0, 5))).toEqual(['Hari ', 'Kemar', groups[2]!.label.slice(0, 5)]);
    expect(groups[2]!.label).toContain('2025');
    expect(groups.map((g) => g.key)).toEqual(['2026-01-01', '2025-12-31', '2025-12-20']);
  });
});
