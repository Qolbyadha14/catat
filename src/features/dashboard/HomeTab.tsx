import React, { useMemo } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { BalanceHeroCard } from './BalanceHeroCard';
import { UpcomingBillsCard } from './UpcomingBillsCard';
import type { Account, Transaction } from '../../lib/schemas';
import type { UpcomingBill } from '../../lib/bills';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';
import { groupTransactionsByDay } from '../../lib/transactionGroups';
import { useCurrentDay } from '../../lib/useCurrentDay';
import { TransactionRow } from './TransactionRow';

export interface HomeTabProps {
  netBalance: number;
  totalAssets: number;
  totalLiabilities: number;
  hasLiabilities: boolean;
  monthIncome: number;
  monthExpense: number;
  netCashflow: { isSurplus: boolean; formatted: string };
  selectedMonthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  filteredTransactions: Transaction[];
  accountMap: Map<string, { name: string; isArchived?: boolean }>;
  categoryMap: Map<string, { name: string; icon?: string; isArchived?: boolean; monthlyBudget?: number }>;
  accounts: Account[];
  isLoading: boolean;
  isFiltered: boolean;
  activeFilterCount: number;
  onOpenFilter: () => void;
  onResetFilters: () => void;
  onOpenAddModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDuplicateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onPayUpcomingBill: (bill: UpcomingBill) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  netBalance,
  totalAssets,
  totalLiabilities,
  hasLiabilities,
  monthIncome,
  monthExpense,
  netCashflow,
  selectedMonthLabel,
  onPrevMonth,
  onNextMonth,
  filteredTransactions,
  accountMap,
  categoryMap,
  accounts,
  isLoading,
  isFiltered,
  activeFilterCount,
  onOpenFilter,
  onResetFilters,
  onOpenAddModal,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onPayUpcomingBill,
}) => {
  const todayStart = useCurrentDay();
  const dayGroups = useMemo(
    () => groupTransactionsByDay(filteredTransactions, todayStart),
    [filteredTransactions, todayStart]
  );

  return (
    <div className="space-y-4 flex-1 flex flex-col">
      {/* 1. Hero Balance Card */}
      <BalanceHeroCard
        netBalance={netBalance}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        hasLiabilities={hasLiabilities}
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        netCashflow={netCashflow}
        selectedMonthLabel={selectedMonthLabel}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />

      {/* 2. Upcoming PayLater / Bills reminder card */}
      <div className="px-5">
        <UpcomingBillsCard accounts={accounts} onPayBill={onPayUpcomingBill} />
      </div>

      {/* 3. Transaction History Section */}
      <section className="px-5 flex-1 flex flex-col" aria-labelledby="home-history-title">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2
              id="home-history-title"
              className="text-base font-bold text-strong tracking-tight"
            >
              Riwayat Transaksi
            </h2>
            <div className="text-xs font-medium text-subtle">
              {filteredTransactions.length} Transaksi Tercatat
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  playHapticSound('click');
                  onResetFilters();
                }}
                className="px-2 text-xs text-blue-700 dark:text-blue-300 font-bold hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                playHapticSound('click');
                onOpenFilter();
              }}
              className={`relative flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                activeFilterCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-soft text-slate-700 dark:text-slate-200 border-edge hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              aria-label={activeFilterCount > 0 ? `Filter transaksi (${activeFilterCount} aktif)` : 'Filter transaksi'}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span
                  className="min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] leading-5 text-center"
                  aria-hidden="true"
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <div className="space-y-2.5" role="status" aria-busy="true">
            <span className="sr-only">Memuat data transaksi...</span>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="bg-card rounded-2xl p-3.5 border border-line flex items-center gap-3 animate-pulse"
              >
                <div className="w-11 h-11 rounded-2xl bg-edge shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 rounded bg-edge" />
                  <div className="h-2.5 w-3/5 rounded bg-edge" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-3xl py-12 px-6 flex-1 min-h-[220px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200/90 dark:border-slate-700 shadow-2xs my-2">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 text-blue-600 flex items-center justify-center shadow-xs border border-slate-100 dark:border-slate-700 mb-3 text-2xl">
              {isFiltered ? '🔍' : '📝'}
            </div>
            <h3 className="text-base font-bold text-strong tracking-tight">
              {isFiltered ? 'Tidak ada transaksi yang cocok' : `Belum ada transaksi di ${selectedMonthLabel}`}
            </h3>
            <p className="text-xs text-subtle mt-1.5 max-w-xs text-center leading-relaxed">
              {isFiltered
                ? `Tidak ada transaksi ${selectedMonthLabel} yang sesuai dengan filter yang dipilih.`
                : 'Mulai catat transaksi pemasukan atau pengeluaran pertamamu.'}
            </p>
            {isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  playHapticSound('click');
                  onResetFilters();
                }}
                className="mt-4 px-5 rounded-xl bg-white dark:bg-slate-800 border border-edge text-strong text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                Reset Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playHapticSound('success');
                  onOpenAddModal();
                }}
                className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <Plus size={15} />
                <span>Catat Transaksi Sekarang</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {dayGroups.map((group) => (
              <div key={group.key} role="group" aria-labelledby={`day-${group.key}`}>
                <div className="flex items-baseline justify-between gap-2 mb-2 px-1">
                  <h3 id={`day-${group.key}`} className="text-xs font-bold text-strong">
                    {group.label}
                  </h3>
                  <span className="text-[11px] font-semibold text-subtle tabular-nums whitespace-nowrap">
                    {group.expense > 0 && `-${formatIdr(group.expense)}`}
                    {group.expense > 0 && group.income > 0 && ' · '}
                    {group.income > 0 && `+${formatIdr(group.income)}`}
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {group.transactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      accountMap={accountMap}
                      categoryMap={categoryMap}
                      onEdit={onEditTransaction}
                      onDuplicate={onDuplicateTransaction}
                      onDelete={onDeleteTransaction}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
