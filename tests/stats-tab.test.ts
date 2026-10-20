import { describe, it, expect } from 'bun:test';
import { generateCsvContent } from '../src/features/analytics/exportCsv';
import { StatsTab } from '../src/features/analytics/StatsTab';
import { DonutChart } from '../src/features/analytics/DonutChart';

describe('CSV report generation & StatsTab', () => {
  it('generates valid RFC 4180 CSV rows', () => {
    const mockTxs = [
      { id: '1', date: '2026-10-20', type: 'expense', amount: 50000, note: 'Makan Siang', accountId: 'acc1', categoryId: 'cat1' },
    ];
    const accMap = new Map([['acc1', { name: 'BCA' }]]);
    const catMap = new Map([['cat1', { name: 'Makanan' }]]);
    const csv = generateCsvContent(mockTxs as any, accMap, catMap);
    expect(csv).toContain('Tanggal,Tipe,Kategori,Akun,Nominal,Catatan');
    expect(csv).toContain('2026-10-20,expense,Makanan,BCA,50000,"Makan Siang"');
  });

  it('exports StatsTab and DonutChart cleanly', () => {
    expect(StatsTab).toBeDefined();
    expect(DonutChart).toBeDefined();
  });
});
