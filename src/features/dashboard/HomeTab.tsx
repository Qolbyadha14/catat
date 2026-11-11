import React from 'react';
import {
  Wallet,
  ArrowRightLeft,
  Copy,
  Pencil,
  Trash2,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { BalanceHeroCard } from './BalanceHeroCard';
import { UpcomingBillsCard } from './UpcomingBillsCard';
import type { Account, Transaction } from '../../lib/schemas';
import type { UpcomingBill } from '../../lib/bills';
import { formatIdr, formatDate } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';
import { getCategoryTone, TRANSFER_TONE } from '../../lib/categoryTone';

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

const ACTION_BUTTON_CLASS =
  'p-2 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer';

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
              className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight"
            >
              Pelacakan Transaksi Harian
            </h2>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
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
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs flex-1 flex items-center justify-center">
            Memuat data transaksi...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-3xl py-12 px-6 flex-1 min-h-[220px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200/90 dark:border-slate-700 shadow-2xs my-2">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 text-blue-600 flex items-center justify-center shadow-xs border border-slate-100 dark:border-slate-700 mb-3 text-2xl">
              {isFiltered ? '🔍' : '📝'}
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {isFiltered ? 'Tidak ada transaksi yang cocok' : `Belum ada transaksi di ${selectedMonthLabel}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs text-center leading-relaxed">
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
                className="mt-4 px-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
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
          <ul className="space-y-2.5">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const isExpense = tx.type === 'expense';

              let title: string;
              let subtitle: string;
              let iconContent: React.ReactNode;
              let toneClass: string;

              if (tx.type === 'transfer') {
                const fromAcc = accountMap.get(tx.fromAccountId)?.name || 'Akun';
                const toAcc = accountMap.get(tx.toAccountId)?.name || 'Akun';
                title = `${fromAcc} ➔ ${toAcc}`;
                subtitle = `${formatDate(tx.date)}${tx.note ? ` • ${tx.note}` : ''}`;
                toneClass = TRANSFER_TONE;
                iconContent = <ArrowRightLeft size={18} aria-hidden="true" />;
              } else {
                const cat = categoryMap.get(tx.categoryId);
                const catName = cat?.name || 'Lainnya';
                const accName = accountMap.get(tx.accountId)?.name || 'Akun';
                title = catName;
                subtitle = `${formatDate(tx.date)} • ${accName}${tx.note ? ` • ${tx.note}` : ''}`;
                toneClass = getCategoryTone(tx.categoryId, catName);
                iconContent = cat?.icon ? (
                  <span className="text-lg leading-none" aria-hidden="true">{cat.icon}</span>
                ) : (
                  <Wallet size={18} aria-hidden="true" />
                );
              }

              return (
                <li
                  key={tx.id}
                  className="bg-white dark:bg-slate-800/80 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-3 hover:shadow-md transition-shadow group"
                >
                  {/* Squircle Icon */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold ${toneClass}`}>
                    {iconContent}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Baris 1: judul memakai lebar penuh, nominal di kanan */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate min-w-0">
                        {title}
                      </div>
                      <span
                        className={`text-sm font-extrabold tracking-tight whitespace-nowrap tabular-nums shrink-0 ${
                          isIncome
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isExpense
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-cyan-700 dark:text-cyan-400'
                        }`}
                      >
                        {`${isIncome ? '+' : isExpense ? '-' : ''}${formatIdr(tx.amount)}`}
                      </span>
                    </div>

                    {/* Baris 2: keterangan dan tombol aksi */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
                        <span>{subtitle}</span>
                        {tx.createdBy?.name && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[10px]">
                            👤 {tx.createdBy.name}
                          </span>
                        )}
                        {tx.items && tx.items.length > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                            🛒 {tx.items.length} item
                          </span>
                        )}
                      </div>

                    {/* Quick actions row */}
                    <div className="flex items-center gap-0.5 shrink-0 -mr-2">
                      <button
                        type="button"
                        onClick={() => {
                          playHapticSound('tap');
                          onDuplicateTransaction(tx);
                        }}
                        className={`${ACTION_BUTTON_CLASS} hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-300 dark:hover:bg-blue-950/40`}
                        title="Duplikat Transaksi"
                        aria-label={`Duplikat transaksi ${title}`}
                      >
                        <Copy size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playHapticSound('tap');
                          onEditTransaction(tx);
                        }}
                        className={`${ACTION_BUTTON_CLASS} hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-300 dark:hover:bg-blue-950/40`}
                        title="Ubah Transaksi"
                        aria-label={`Ubah transaksi ${title}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playHapticSound('delete');
                          onDeleteTransaction(tx);
                        }}
                        className={`${ACTION_BUTTON_CLASS} ml-1.5 hover:text-rose-700 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-950/40`}
                        title="Hapus Transaksi"
                        aria-label={`Hapus transaksi ${title}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
