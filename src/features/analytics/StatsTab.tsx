import React, { useMemo } from 'react';
import { PieChart, Download } from 'lucide-react';
import type { Account, Category, Transaction } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { formatMonthYear } from '../../lib/monthNavigator';
import { playHapticSound } from '../../lib/haptic';
import { DonutChart, type DonutSlice } from './DonutChart';
import { generateCsvContent, downloadCsv } from './exportCsv';
import { WeeklyCashflowChart } from '../dashboard/WeeklyCashflowChart';

export interface StatsTabProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  selectedMonth: Date;
}

const PALETTE = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#10b981', // emerald
  '#a855f7', // purple
  '#f43f5e', // rose
  '#eab308', // amber
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

export const StatsTab: React.FC<StatsTabProps> = ({
  transactions,
  categories,
  accounts,
  selectedMonth,
}) => {
  const monthLabel = formatMonthYear(selectedMonth);

  // Filter current month transactions
  const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1, 0, 0, 0, 0).getTime();
  const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1, 0, 0, 0, 0).getTime();

  const monthExpenses = useMemo(() => {
    return transactions.filter(
      (t): t is Extract<Transaction, { type: 'expense' }> =>
        t.type === 'expense' && t.date >= startOfMonth && t.date < endOfMonth
    );
  }, [transactions, startOfMonth, endOfMonth]);

  const totalExpense = useMemo(() => {
    return monthExpenses.reduce((sum, t) => sum + t.amount, 0);
  }, [monthExpenses]);

  // Group by category
  const donutData: DonutSlice[] = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((t) => {
      const current = map.get(t.categoryId) || 0;
      map.set(t.categoryId, current + t.amount);
    });

    const slices: DonutSlice[] = [];
    let idx = 0;
    map.forEach((amt, catId) => {
      const cat = categories.find((c) => c.id === catId);
      const name = cat?.name || 'Lainnya';
      const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
      slices.push({
        id: catId,
        name,
        amount: amt,
        percentage: pct,
        color: PALETTE[idx % PALETTE.length] || '#3b82f6',
        icon: cat?.icon,
      });
      idx++;
    });

    return slices.sort((a, b) => b.amount - a.amount);
  }, [monthExpenses, categories, totalExpense]);

  // Account and Category maps for CSV export
  const accountMap = useMemo(() => {
    const map = new Map<string, { name: string }>();
    accounts.forEach((a) => map.set(a.id, { name: a.name }));
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string }>();
    categories.forEach((c) => map.set(c.id, { name: c.name }));
    return map;
  }, [categories]);

  const handleExportCsv = () => {
    playHapticSound('success');
    const content = generateCsvContent(transactions, accountMap, categoryMap);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`catat_laporan_keuangan_${dateStr}.csv`, content);
  };

  return (
    <div className="px-5 space-y-5 mb-8 animate-in fade-in duration-200">
      {/* Top Header with Export Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Statistik & Analisis</h2>
          <div className="text-[11px] font-medium text-slate-400 mt-0.5">
            Periode: {monthLabel}
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
        >
          <Download size={13} />
          <span>Ekspor CSV</span>
        </button>
      </div>

      {/* Donut Chart Card */}
      <div className="bg-white rounded-[32px] p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <PieChart size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Distribusi Pengeluaran</h3>
              <p className="text-[10px] text-slate-400">Berdasarkan proporsi kategori</p>
            </div>
          </div>
        </div>

        {totalExpense === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Belum ada pengeluaran di {monthLabel}.
          </div>
        ) : (
          <DonutChart data={donutData} totalAmount={totalExpense} selectedMonthLabel={monthLabel} />
        )}
      </div>

      {/* Weekly Cashflow Chart */}
      <div className="bg-white rounded-[32px] p-1 border border-slate-100 shadow-sm overflow-hidden">
        <WeeklyCashflowChart
          transactions={transactions}
          year={selectedMonth.getFullYear()}
          month={selectedMonth.getMonth() + 1}
          monthLabel={monthLabel}
        />
      </div>

      {/* Ranked Category Spending List */}
      {donutData.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Peringkat Pengeluaran Kategori
          </h3>

          <div className="space-y-2">
            {donutData.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{item.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {item.percentage.toFixed(1)}% dari total pengeluaran
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">
                    {formatIdr(item.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
