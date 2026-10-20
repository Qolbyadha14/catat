import React, { useState, useMemo } from 'react';
import { Search, X, Wallet, ArrowRightLeft } from 'lucide-react';
import type { Account, Category, Transaction } from '../../lib/schemas';
import { formatIdr, formatDate } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  transactions,
  categories,
  accounts,
  onSelectTransaction,
}) => {
  const [query, setQuery] = useState('');

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!query.trim()) return transactions.slice(0, 20);
    const q = query.toLowerCase().trim();

    return transactions.filter((t) => {
      const catName = ('categoryId' in t && t.categoryId ? (categoryMap.get(t.categoryId) || '') : '').toLowerCase();
      const accName = ('accountId' in t && t.accountId ? (accountMap.get(t.accountId) || '') : '').toLowerCase();
      const fromName = ('fromAccountId' in t && t.fromAccountId ? (accountMap.get(t.fromAccountId) || '') : '').toLowerCase();
      const toName = ('toAccountId' in t && t.toAccountId ? (accountMap.get(t.toAccountId) || '') : '').toLowerCase();
      const note = (t.note || '').toLowerCase();
      const amt = t.amount.toString();
      const dateText = formatDate(t.date).toLowerCase();

      return (
        note.includes(q) ||
        catName.includes(q) ||
        accName.includes(q) ||
        fromName.includes(q) ||
        toName.includes(q) ||
        amt.includes(q) ||
        dateText.includes(q)
      );
    });
  }, [query, transactions, categoryMap, accountMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-200 mt-8 max-h-[85vh] flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari transaksi, nominal, akun, kategori..."
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              playHapticSound('click');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Tidak ada transaksi yang cocok dengan "{query}".
            </div>
          ) : (
            filtered.map((tx) => {
              const isIncome = tx.type === 'income';
              const isExpense = tx.type === 'expense';
              const isTransfer = tx.type === 'transfer';

              let title = tx.note || 'Transaksi';
              let subtitle = formatDate(tx.date);

              if (isTransfer) {
                const from = accountMap.get(tx.fromAccountId) || 'Akun';
                const to = accountMap.get(tx.toAccountId) || 'Akun';
                title = `${from} ➔ ${to}`;
                subtitle = `${formatDate(tx.date)}${tx.note ? ` • ${tx.note}` : ''}`;
              } else {
                const cat = categoryMap.get(tx.categoryId) || 'Lainnya';
                const acc = accountMap.get(tx.accountId) || 'Akun';
                title = cat;
                subtitle = `${formatDate(tx.date)} • ${acc}${tx.note ? ` • ${tx.note}` : ''}`;
              }

              return (
                <div
                  key={tx.id}
                  onClick={() => {
                    playHapticSound('tap');
                    if (onSelectTransaction) onSelectTransaction(tx);
                    onClose();
                  }}
                  className="bg-slate-50 hover:bg-blue-50/60 rounded-2xl p-3 border border-slate-100/80 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center text-slate-600 font-bold shrink-0">
                      {isTransfer ? <ArrowRightLeft size={16} /> : <Wallet size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{title}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{subtitle}</div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-extrabold shrink-0 ${
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
