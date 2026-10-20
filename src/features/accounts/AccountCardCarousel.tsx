import React from 'react';
import type { Account } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';
import { getAccountDebt } from '../../lib/accountCalculations';

interface AccountCardCarouselProps {
  accounts: Account[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}

export const AccountCardCarousel: React.FC<AccountCardCarouselProps> = ({
  accounts,
  selectedIndex,
  onSelectIndex,
}) => {
  // Gradient picker based on account type and name
  const getCardStyle = (acc: Account) => {
    const isLiability = acc.kind === 'liability' || acc.type === 'liability';
    const nameLower = acc.name.toLowerCase();

    if (isLiability) {
      return {
        gradient: 'from-rose-950 via-rose-800 to-slate-900',
        logoText: 'PAYLATER',
        chipColor: 'bg-rose-400/80 border-rose-300/80',
        cardType: 'Liabilitas',
      };
    }
    if (nameLower.includes('bca')) {
      return {
        gradient: 'from-[#003882] via-[#0055b8] to-[#00204d]',
        logoText: 'BCA',
        chipColor: 'bg-amber-300/80 border-amber-400/80',
        cardType: 'Debit Prioritas',
      };
    }
    if (nameLower.includes('mandiri')) {
      return {
        gradient: 'from-[#002d62] via-[#0b4f9c] to-[#001f44]',
        logoText: 'MANDIRI',
        chipColor: 'bg-amber-300/80 border-amber-400/80',
        cardType: 'Debit Card',
      };
    }
    if (nameLower.includes('gopay') || nameLower.includes('ovo') || nameLower.includes('dana') || nameLower.includes('shopee')) {
      return {
        gradient: 'from-teal-800 via-emerald-700 to-slate-900',
        logoText: acc.name.toUpperCase(),
        chipColor: 'bg-emerald-300/80 border-emerald-400/80',
        cardType: 'E-Wallet',
      };
    }
    if (acc.type === 'cash') {
      return {
        gradient: 'from-slate-800 via-slate-700 to-zinc-900',
        logoText: 'CASH',
        chipColor: 'bg-zinc-400/80 border-zinc-300/80',
        cardType: 'Dompet Tunai',
      };
    }

    return {
      gradient: 'from-blue-900 via-indigo-800 to-slate-900',
      logoText: acc.name.slice(0, 10).toUpperCase(),
      chipColor: 'bg-amber-300/80 border-amber-400/80',
      cardType: 'Rekening',
    };
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto no-scrollbar flex gap-3.5 snap-x snap-mandatory py-1 px-5">
        {accounts.map((acc, index) => {
          const style = getCardStyle(acc);
          const isLiability = acc.kind === 'liability' || acc.type === 'liability';
          const debt = isLiability ? getAccountDebt(acc) : 0;
          const isSelected = selectedIndex === index;

          return (
            <div
              key={acc.id}
              onClick={() => {
                playHapticSound('tap');
                onSelectIndex(index);
              }}
              className={`min-w-[280px] sm:min-w-[310px] snap-center rounded-[28px] p-5 text-white shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] bg-gradient-to-tr ${style.gradient} relative overflow-hidden border ${
                isSelected ? 'border-white/40 ring-2 ring-white/20' : 'border-white/10'
              }`}
            >
              {/* Gloss reflection overlay */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-44 h-44 bg-white/10 rounded-full blur-xl pointer-events-none" />

              {/* Top card row: Logo & Chip */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  {/* EMV Chip visual */}
                  <div className={`w-8 h-6 rounded-md ${style.chipColor} border flex items-center justify-center p-0.5 shadow-xs`}>
                    <div className="w-full h-full border border-amber-700/30 rounded-xs grid grid-cols-2 gap-0.5" />
                  </div>
                  <span className="text-[11px] font-black tracking-widest uppercase opacity-90">
                    {style.logoText}
                  </span>
                </div>

                {/* Overlapping circles visual (Mastercard-like) */}
                <div className="flex -space-x-2">
                  <div className="w-5 h-5 rounded-full bg-rose-500/90 shadow-xs" />
                  <div className="w-5 h-5 rounded-full bg-amber-400/90 shadow-xs" />
                </div>
              </div>

              {/* Card Number masked */}
              <div className="font-mono text-sm tracking-widest font-semibold mb-4 text-slate-200">
                •••• •••• •••• {acc.id.slice(-4).toUpperCase() || '5083'}
              </div>

              {/* Bottom Row: Holder & Balance */}
              <div className="flex items-end justify-between border-t border-white/15 pt-2.5">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-300 block">
                    {style.cardType}
                  </span>
                  <span className="text-xs font-bold truncate max-w-[140px] block text-white">
                    {acc.name}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-slate-300 block">
                    {isLiability ? 'Total Tagihan' : 'Saldo'}
                  </span>
                  <span
                    className={`text-sm font-black tracking-tight ${
                      isLiability
                        ? debt > 0
                          ? 'text-rose-300'
                          : 'text-emerald-300'
                        : 'text-white'
                    }`}
                  >
                    {isLiability
                      ? debt > 0
                        ? formatIdr(debt)
                        : '✓ Rp 0 (Lunas)'
                      : formatIdr(acc.balance)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
