import React from 'react';
import { Wallet, ArrowRightLeft, Copy, Pencil, Trash2 } from 'lucide-react';
import type { Transaction } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';
import { getCategoryTone, TRANSFER_TONE } from '../../lib/categoryTone';

export interface TransactionRowProps {
  tx: Transaction;
  accountMap: Map<string, { name: string }>;
  categoryMap: Map<string, { name: string; icon?: string }>;
  onEdit: (tx: Transaction) => void;
  onDuplicate: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

const ACTION_BUTTON_CLASS = 'p-2 rounded-lg text-subtle transition-colors cursor-pointer';
const BLUE_HOVER = 'hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-300 dark:hover:bg-blue-950/40';
const ROSE_HOVER = 'hover:text-rose-700 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-950/40';

/** Satu baris transaksi. Tanggal tidak ditampilkan di sini karena sudah ada di header grup harian. */
export const TransactionRow: React.FC<TransactionRowProps> = ({
  tx,
  accountMap,
  categoryMap,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  let title: string;
  let subtitle: string;
  let toneClass: string;
  let icon: React.ReactNode;

  if (tx.type === 'transfer') {
    const from = accountMap.get(tx.fromAccountId)?.name || 'Akun';
    const to = accountMap.get(tx.toAccountId)?.name || 'Akun';
    title = `${from} ➔ ${to}`;
    subtitle = tx.note || 'Transfer antar akun';
    toneClass = TRANSFER_TONE;
    icon = <ArrowRightLeft size={18} aria-hidden="true" />;
  } else {
    const category = categoryMap.get(tx.categoryId);
    const categoryName = category?.name || 'Lainnya';
    const accountName = accountMap.get(tx.accountId)?.name || 'Akun';
    title = categoryName;
    subtitle = `${accountName}${tx.note ? ` • ${tx.note}` : ''}`;
    toneClass = getCategoryTone(tx.categoryId, categoryName);
    icon = category?.icon ? (
      <span className="text-lg leading-none" aria-hidden="true">{category.icon}</span>
    ) : (
      <Wallet size={18} aria-hidden="true" />
    );
  }

  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
  const amountTone =
    tx.type === 'income'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tx.type === 'expense'
      ? 'text-strong'
      : 'text-cyan-700 dark:text-cyan-400';

  return (
    <li className="bg-card rounded-2xl p-3.5 border border-line shadow-xs flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold ${toneClass}`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        {/* Baris 1: judul memakai lebar penuh, nominal di kanan */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-bold text-strong truncate min-w-0">{title}</div>
          <span className={`text-sm font-extrabold tracking-tight whitespace-nowrap tabular-nums shrink-0 ${amountTone}`}>
            {`${sign}${formatIdr(tx.amount)}`}
          </span>
        </div>

        {/* Baris 2: keterangan dan tombol aksi */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-subtle min-w-0 truncate">
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

          <div className="flex items-center gap-0.5 shrink-0 -mr-2">
            <button
              type="button"
              onClick={() => {
                playHapticSound('tap');
                onDuplicate(tx);
              }}
              className={`${ACTION_BUTTON_CLASS} ${BLUE_HOVER}`}
              title="Duplikat Transaksi"
              aria-label={`Duplikat transaksi ${title}`}
            >
              <Copy size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                playHapticSound('tap');
                onEdit(tx);
              }}
              className={`${ACTION_BUTTON_CLASS} ${BLUE_HOVER}`}
              title="Ubah Transaksi"
              aria-label={`Ubah transaksi ${title}`}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                playHapticSound('delete');
                onDelete(tx);
              }}
              className={`${ACTION_BUTTON_CLASS} ml-1.5 ${ROSE_HOVER}`}
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
};
