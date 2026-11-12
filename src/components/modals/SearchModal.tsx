import React, { useState, useMemo } from 'react';
import { Search, X, Wallet, ArrowRightLeft } from 'lucide-react';
import type { Account, Category, Transaction } from '../../lib/schemas';
import { formatIdr, formatDate } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { searchTransactions } from '../../lib/transactionSearch';
import { MAX_SEARCH_TRANSACTIONS, useAllTransactions } from '../../features/transactions/useAllTransactions';

/** Jumlah hasil maksimum yang dirender sekaligus agar daftar tetap ringan. */
const MAX_RESULTS = 100;
const NUMBER_FORMAT = new Intl.NumberFormat('id-ID');

type SearchScope = 'month' | 'all';

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  /** Buku kas keluarga aktif; kosong berarti buku kas pribadi. */
  ledgerId?: string;
  /** Transaksi bulan yang sedang dibuka di dashboard (cakupan "bulan ini"). */
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
  /** Label bulan yang sedang dibuka, misalnya "November 2026" */
  scopeLabel?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  uid,
  ledgerId,
  transactions,
  categories,
  accounts,
  onSelectTransaction,
  scopeLabel,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('month');

  useEscapeKey(isOpen, onClose);

  // Riwayat lintas bulan hanya diambil saat pencarian terbuka dan cakupan "semua riwayat" dipilih
  const history = useAllTransactions(uid, ledgerId, isOpen && scope === 'all');
  const source = scope === 'all' ? history.transactions : transactions;

  const lookups = useMemo(
    () => ({
      accountNames: new Map(accounts.map((a) => [a.id, a.name] as const)),
      categoryNames: new Map(categories.map((c) => [c.id, c.name] as const)),
    }),
    [accounts, categories]
  );

  const matches = useMemo(() => {
    if (!query.trim()) return source.slice(0, 20);
    return searchTransactions(source, query, lookups);
  }, [query, source, lookups]);
  const visible = matches.slice(0, MAX_RESULTS);

  if (!isOpen) return null;

  const placeholder =
    scope === 'all'
      ? 'Cari di semua riwayat...'
      : scopeLabel
      ? `Cari transaksi ${scopeLabel}...`
      : 'Cari transaksi, nominal, akun, kategori...';

  const scopeButtonClass = (active: boolean) =>
    `flex-1 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
    }`;

  const emptyMessage = () => {
    if (scope === 'all' && history.loading) return 'Memuat riwayat...';
    if (scope === 'all' && history.error) return `Gagal memuat riwayat: ${history.error}`;
    if (query.trim()) return `Tidak ada transaksi yang cocok dengan "${query}".`;
    if (scope === 'all') return 'Belum ada transaksi.';
    return `Belum ada transaksi${scopeLabel ? ` di ${scopeLabel}` : ''}.`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cari transaksi"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-frame border border-transparent dark:border-slate-800 rounded-3xl p-5 shadow-2xl mt-8 max-h-[85vh] flex flex-col"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2 pb-3 border-b border-line">
          <div className="relative flex-1">
            <Search
              size={18}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label="Kata kunci pencarian"
              className="w-full pl-9 pr-10 py-2.5 rounded-2xl bg-soft border border-edge text-strong placeholder:text-subtle text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Hapus kata kunci"
                className="absolute right-0 top-1/2 -translate-y-1/2 w-10 flex items-center justify-center text-subtle hover:text-strong cursor-pointer"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              playHapticSound('click');
              onClose();
            }}
            aria-label="Tutup pencarian"
            className="w-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Cakupan pencarian */}
        <div className="flex gap-2 pt-3" role="group" aria-label="Cakupan pencarian">
          <button
            type="button"
            aria-pressed={scope === 'month'}
            onClick={() => setScope('month')}
            className={scopeButtonClass(scope === 'month')}
          >
            {scopeLabel ?? 'Bulan ini'}
          </button>
          <button
            type="button"
            aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}
            className={scopeButtonClass(scope === 'all')}
          >
            Semua riwayat
          </button>
        </div>

        {/* Ringkasan hasil */}
        <div className="pt-2 text-[11px] text-subtle" role="status" aria-live="polite">
          {scope === 'all' && history.loading
            ? 'Memuat riwayat...'
            : query.trim()
            ? `${NUMBER_FORMAT.format(matches.length)} hasil${matches.length > MAX_RESULTS ? `, menampilkan ${MAX_RESULTS} teratas` : ''}`
            : scope === 'all' && history.truncated
            ? `Riwayat terbaru dimuat (maksimal ${NUMBER_FORMAT.format(MAX_SEARCH_TRANSACTIONS)} transaksi)`
            : '\u00A0'}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-3 pt-1 space-y-2">
          {visible.length === 0 ? (
            <div className="text-center py-10 text-subtle text-xs">{emptyMessage()}</div>
          ) : (
            visible.map((tx) => {
              const isIncome = tx.type === 'income';
              const isExpense = tx.type === 'expense';
              const isTransfer = tx.type === 'transfer';

              let title = tx.note || 'Transaksi';
              let subtitle = formatDate(tx.date);

              if (isTransfer) {
                const from = lookups.accountNames.get(tx.fromAccountId) || 'Akun';
                const to = lookups.accountNames.get(tx.toAccountId) || 'Akun';
                title = `${from} ➔ ${to}`;
                subtitle = `${formatDate(tx.date)}${tx.note ? ` • ${tx.note}` : ''}`;
              } else {
                const cat = lookups.categoryNames.get(tx.categoryId) || 'Lainnya';
                const acc = lookups.accountNames.get(tx.accountId) || 'Akun';
                title = cat;
                subtitle = `${formatDate(tx.date)} • ${acc}${tx.note ? ` • ${tx.note}` : ''}`;
              }

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => {
                    playHapticSound('tap');
                    if (onSelectTransaction) onSelectTransaction(tx);
                    onClose();
                  }}
                  className="w-full text-left bg-soft hover:bg-blue-50/60 dark:hover:bg-slate-800 rounded-2xl p-3 border border-line flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-frame border border-edge flex items-center justify-center text-subtle font-bold shrink-0">
                      {isTransfer ? <ArrowRightLeft size={16} aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-strong truncate">{title}</div>
                      <div className="text-[11px] text-subtle truncate mt-0.5">{subtitle}</div>
                    </div>
                  </div>

                  <span
                    className={`text-sm font-extrabold shrink-0 whitespace-nowrap tabular-nums ${
                      isIncome
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : isExpense
                        ? 'text-strong'
                        : 'text-cyan-700 dark:text-cyan-400'
                    }`}
                  >
                    {`${isIncome ? '+' : isExpense ? '-' : ''}${formatIdr(tx.amount)}`}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
