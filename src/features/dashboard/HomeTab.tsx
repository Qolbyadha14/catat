import React from 'react';
import {
  Utensils,
  Briefcase,
  ShoppingBag,
  Car,
  Zap,
  HeartPulse,
  Tv,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Copy,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import { BalanceHeroCard } from './BalanceHeroCard';
import { UpcomingBillsCard } from './UpcomingBillsCard';
import type { Account, Category, Transaction } from '../../lib/schemas';
import type { UpcomingBill } from '../../lib/bills';
import { formatIdr, formatDate } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';

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
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  accountMap: Map<string, { name: string; isArchived?: boolean }>;
  categoryMap: Map<string, { name: string; icon?: string; isArchived?: boolean; monthlyBudget?: number }>;
  categories: Category[];
  accounts: Account[];
  isLoading: boolean;
  isFiltered: boolean;
  onResetFilters: () => void;
  onOpenAddModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDuplicateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onPayUpcomingBill: (bill: UpcomingBill) => void;
  onOpenBudgetsTab: () => void;
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
  categories,
  accounts,
  isLoading,
  isFiltered,
  onResetFilters,
  onOpenAddModal,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onPayUpcomingBill,
  onOpenBudgetsTab,
}) => {
  // Helper for category squircle icons & colors
  const getCategoryDetails = (catId?: string) => {
    const cat = catId ? categoryMap.get(catId) : undefined;
    const name = cat?.name || 'Lainnya';
    const iconName = cat?.icon || 'Wallet';

    // Pastel styling map
    let bg = 'bg-blue-100 text-blue-600';
    if (name.includes('Makan') || name.includes('Food')) bg = 'bg-orange-100 text-orange-600';
    else if (name.includes('Gaji') || name.includes('Income')) bg = 'bg-emerald-100 text-emerald-600';
    else if (name.includes('Belanja') || name.includes('Shop')) bg = 'bg-purple-100 text-purple-600';
    else if (name.includes('Transport') || name.includes('Kendaraan')) bg = 'bg-amber-100 text-amber-600';
    else if (name.includes('Tagihan') || name.includes('Listrik')) bg = 'bg-blue-100 text-blue-600';
    else if (name.includes('Kesehatan') || name.includes('Health')) bg = 'bg-rose-100 text-rose-600';

    return { name, bg, iconName };
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
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
      <section className="px-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Pelacakan Transaksi Harian</h2>
            <div className="text-[11px] font-medium text-slate-400">
              {filteredTransactions.length} Transaksi Tercatat
            </div>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                playHapticSound('click');
                onResetFilters();
              }}
              className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Memuat data transaksi...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 text-center border border-slate-100 shadow-sm my-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-xl">
              📝
            </div>
            <h3 className="text-sm font-bold text-slate-800">Belum Ada Transaksi</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
              Mulai catat transaksi pemasukan atau pengeluaran pertamamu.
            </p>
            <button
              type="button"
              onClick={() => {
                playHapticSound('success');
                onOpenAddModal();
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/25 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Catat Transaksi Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const isExpense = tx.type === 'expense';
              const isTransfer = tx.type === 'transfer';

              let title = tx.note || 'Transaksi';
              let subtitle = formatDate(tx.date);
              let iconContent = <Wallet size={18} />;
              let badgeColor = 'bg-blue-100 text-blue-600';

              if (isTransfer) {
                const fromAcc = accountMap.get(tx.fromAccountId)?.name || 'Akun';
                const toAcc = accountMap.get(tx.toAccountId)?.name || 'Akun';
                title = `${fromAcc} ➔ ${toAcc}`;
                subtitle = `${formatDate(tx.date)}${tx.note ? ` • ${tx.note}` : ''}`;
                badgeColor = 'bg-cyan-100 text-cyan-700';
                iconContent = <ArrowRightLeft size={18} />;
              } else {
                const details = getCategoryDetails(tx.categoryId);
                const accName = accountMap.get(tx.accountId)?.name || 'Akun';
                title = details.name;
                subtitle = `${formatDate(tx.date)} • ${accName}${tx.note ? ` • ${tx.note}` : ''}`;
                badgeColor = details.bg;
              }

              return (
                <div
                  key={tx.id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow group"
                >
                  {/* Left: Squircle Icon & Title/Subtitle */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold ${badgeColor}`}
                    >
                      {iconContent}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1.5 flex-wrap">
                        <span>{subtitle}</span>
                        {tx.createdBy?.name && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold text-[9px]">
                            👤 {tx.createdBy.name}
                          </span>
                        )}
                        {tx.items && tx.items.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[9px]">
                            🛒 {tx.items.length} item
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Nominal & Action Buttons */}
                  <div className="flex flex-col items-end shrink-0 pl-1">
                    <span
                      className={`text-xs font-extrabold tracking-tight ${
                        isIncome
                          ? 'text-emerald-600'
                          : isExpense
                          ? 'text-slate-900'
                          : 'text-cyan-700'
                      }`}
                    >
                      {isIncome ? '+' : isExpense ? '-' : ''}
                      {formatIdr(tx.amount)}
                    </span>

                    {/* Quick actions row */}
                    <div className="flex items-center gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          playHapticSound('tap');
                          onDuplicateTransaction(tx);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Duplikat Transaksi"
                        aria-label="Duplikat Transaksi"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playHapticSound('tap');
                          onEditTransaction(tx);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Ubah Transaksi"
                        aria-label="Ubah Transaksi"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playHapticSound('delete');
                          onDeleteTransaction(tx);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus Transaksi"
                        aria-label="Hapus Transaksi"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
