import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { Category } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';

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
  const [limitStr, setLimitStr] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (category?.monthlyBudget) {
      setLimitStr(category.monthlyBudget.toString());
    } else {
      setLimitStr('');
    }
  }, [category]);

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
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan anggaran');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-t-[36px] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
              {category.icon || '🎯'}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Atur Limit Anggaran</h3>
              <p className="text-[11px] text-slate-400">Kategori: {category.name}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playHapticSound('click');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Batas Belanja Bulanan (Rupiah)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                value={limitStr}
                onChange={(e) => setLimitStr(e.target.value)}
                placeholder="0 (tanpa limit)"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="10000"
              />
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
              Pilihan Cepat
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickSelect(amt)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    parseFloat(limitStr) === amt
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {formatIdr(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Batas Anggaran'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
