import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Category } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useToast } from '../../components/feedback/useToast';

export interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onSaveBudget: (categoryId: string, monthlyLimit: number) => Promise<void>;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  category,
  onSaveBudget,
}) => {
  // Pemanggil memasang key={category.id}, jadi nilai awal cukup dibaca sekali dari props
  const [limitStr, setLimitStr] = useState<string>(() =>
    category?.monthlyBudget ? category.monthlyBudget.toString() : ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const showToast = useToast();

  useEscapeKey(isOpen, onClose);

  const quickAmounts = [500000, 1000000, 2000000, 3500000, 5000000];

  const handleQuickSelect = (amt: number) => {
    playHapticSound('tap');
    setLimitStr(amt.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    const val = parseFloat(limitStr) || 0;
    try {
      setIsSaving(true);
      await onSaveBudget(category.id, val);
      playHapticSound('success');
      showToast(`Anggaran ${category.name} disimpan`, { variant: 'success' });
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan anggaran');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-frame border border-transparent dark:border-slate-800 rounded-t-[36px] sm:rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-sm font-bold">
              {category.icon || '🎯'}
            </div>
            <div>
              <h3 id="budget-modal-title" className="text-base font-extrabold text-strong">
                Atur Limit Anggaran
              </h3>
              <p className="text-xs text-subtle">Kategori: {category.name}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playHapticSound('click');
              onClose();
            }}
            aria-label="Tutup"
            className="w-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="budget-limit-input"
              className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1"
            >
              Batas Belanja Bulanan (Rupiah)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-subtle">
                Rp
              </span>
              <input
                id="budget-limit-input"
                type="number"
                inputMode="numeric"
                value={limitStr}
                onChange={(e) => setLimitStr(e.target.value)}
                placeholder="0 (tanpa limit)"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-soft border border-edge text-strong placeholder:text-slate-500 dark:placeholder:text-slate-400 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="10000"
              />
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-subtle block mb-1.5">
              Pilihan Cepat
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickAmounts.map((amt) => {
                const isSelected = parseFloat(limitStr) === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickSelect(amt)}
                    aria-pressed={isSelected}
                    className={`px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {formatIdr(amt)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-bold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={16} aria-hidden="true" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Batas Anggaran'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
