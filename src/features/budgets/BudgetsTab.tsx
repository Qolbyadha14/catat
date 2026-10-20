import React from 'react';
import { Target, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import type { Category, Transaction } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';

export interface BudgetsTabProps {
  categories: Category[];
  transactions: Transaction[];
  onOpenBudgetModal: (category: Category) => void;
}

export const BudgetsTab: React.FC<BudgetsTabProps> = ({
  categories,
  transactions,
  onOpenBudgetModal,
}) => {
  const activeCategories = categories.filter((c) => !c.isArchived);

  // Filter current month transactions
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).getTime();

  const currentMonthExpenses = transactions.filter(
    (t): t is Extract<Transaction, { type: 'expense' }> =>
      t.type === 'expense' && t.date >= startOfMonth && t.date < endOfMonth
  );

  // Group budgets
  const budgetedCategories = activeCategories
    .filter((c) => c.monthlyBudget && c.monthlyBudget > 0)
    .map((cat) => {
      const spent = currentMonthExpenses
        .filter((t) => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      const limit = cat.monthlyBudget || 0;
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;
      const remaining = Math.max(0, limit - spent);

      return {
        ...cat,
        spent,
        limit,
        percentage,
        remaining,
        isOnTrack: percentage <= 80,
        isOver: percentage > 100,
      };
    });

  const unbudgetedCategories = activeCategories.filter(
    (c) => !c.monthlyBudget || c.monthlyBudget <= 0
  );

  const totalBudget = budgetedCategories.reduce((sum, c) => sum + c.limit, 0);
  const totalSpent = budgetedCategories.reduce((sum, c) => sum + c.spent, 0);
  const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="px-5 space-y-5 mb-8 animate-in fade-in duration-200">
      {/* Header Overview Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md border border-slate-700/60 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-cyan-300 flex items-center justify-center font-bold">
              <Target size={16} />
            </div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Total Anggaran Bulan Ini
            </span>
          </div>

          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              totalPercentage > 100
                ? 'bg-rose-500/20 text-rose-300'
                : totalPercentage > 80
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {totalPercentage.toFixed(0)}% Terpakai
          </span>
        </div>

        <div className="text-2xl font-black text-white tracking-tight mb-2">
          {formatIdr(totalSpent)}{' '}
          <span className="text-xs font-semibold text-slate-400">/ {formatIdr(totalBudget)}</span>
        </div>

        {/* Big Progress Bar */}
        <div className="w-full bg-slate-700/60 h-2.5 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              totalPercentage > 100
                ? 'bg-rose-500'
                : totalPercentage > 80
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-cyan-400 to-blue-500'
            }`}
            style={{ width: `${Math.min(100, totalPercentage)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <span>{budgetedCategories.length} Kategori Memiliki Limit</span>
          <span>Sisa: {formatIdr(Math.max(0, totalBudget - totalSpent))}</span>
        </div>
      </div>

      {/* Budgeted Categories List */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Rincian Anggaran Kategori</h2>

        {budgetedCategories.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-xs">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="text-sm font-bold text-slate-800">Belum Ada Target Anggaran</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
              Pasang limit bulanan pada kategori pengeluaranmu agar keuangan lebih terkontrol.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {budgetedCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  playHapticSound('tap');
                  onOpenBudgetModal(cat);
                }}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                      {cat.icon || '🏷️'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {cat.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatIdr(cat.spent)} dari {formatIdr(cat.limit)}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      cat.isOver
                        ? 'bg-rose-50 text-rose-700'
                        : cat.isOnTrack
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {cat.isOver ? (
                      <>
                        <AlertTriangle size={11} />
                        <span>Melebihi</span>
                      </>
                    ) : cat.isOnTrack ? (
                      <>
                        <CheckCircle2 size={11} />
                        <span>On Track</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={11} />
                        <span>Waspada</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1 mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      cat.isOver
                        ? 'bg-rose-500'
                        : cat.isOnTrack
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{cat.percentage.toFixed(0)}% terpakai</span>
                  <span className="font-semibold text-slate-600">
                    Sisa: {formatIdr(cat.remaining)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Unbudgeted Categories */}
      {unbudgetedCategories.length > 0 && (
        <section className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Kategori Tanpa Limit
            </h3>
            <span className="text-[10px] text-slate-400">
              {unbudgetedCategories.length} Kategori
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {unbudgetedCategories.slice(0, 6).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  playHapticSound('tap');
                  onOpenBudgetModal(cat);
                }}
                className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs hover:border-blue-200 text-left flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">{cat.icon || '🏷️'}</span>
                  <span className="text-xs font-bold text-slate-800 truncate">{cat.name}</span>
                </div>
                <Plus size={13} className="text-blue-600 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
