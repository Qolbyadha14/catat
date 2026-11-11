import { describe, it, expect } from 'bun:test';
import { exportTransactionsCSV } from '../src/lib/exportTransactionsCSV';
import { StatsTab } from '../src/features/analytics/StatsTab';
import { DonutChart } from '../src/features/analytics/DonutChart';
import type { Transaction } from '../src/lib/schemas';

describe('CSV report generation & StatsTab', () => {
  it('ekspor Statistik memakai tanggal terbaca dan menetralkan formula', () => {
    const tx = {
      id: '1',
      type: 'expense',
      amount: 50000,
      accountId: 'acc1',
      categoryId: 'cat1',
      date: new Date(2026, 9, 20, 12).getTime(),
      note: '=HYPERLINK("http://evil")',
      createdAt: 1,
      updatedAt: 1,
    } as Transaction;
    const csv = exportTransactionsCSV(
      [tx],
      [{ id: 'acc1', name: 'BCA, Utama' }],
      [{ id: 'cat1', name: 'Makanan' }]
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('2026-10-20,expense,50000,"BCA, Utama",Makanan,');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('exports StatsTab and DonutChart cleanly', () => {
    expect(StatsTab).toBeDefined();
    expect(DonutChart).toBeDefined();
  });
});
