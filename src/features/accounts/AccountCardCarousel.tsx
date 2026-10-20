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
    const isLiability = acc.kind === 'liability';
    const nameLower = acc.name.toLowerCase();

    if (isLiability) {
      return {
        gradient: 'from-rose-950 via-rose-900 to-slate-900',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        badgeText: 'PayLater',
      };
    }
    if (nameLower.includes('bca')) {
      return {
        gradient: 'from-[#003366] via-[#004080] to-[#002244]',
        badgeBg: 'bg-blue-400/20 text-blue-200 border-blue-400/30',
        badgeText: 'Bank BCA',
      };
    }
    if (nameLower.includes('mandiri')) {
      return {
        gradient: 'from-[#002855] via-[#003d7a] to-[#001f3f]',
        badgeBg: 'bg-sky-400/20 text-sky-200 border-sky-400/30',
        badgeText: 'Bank Mandiri',
      };
    }
    if (nameLower.includes('gopay') || nameLower.includes('ovo') || nameLower.includes('dana') || nameLower.includes('shopee')) {
      return {
        gradient: 'from-teal-900 via-emerald-800 to-slate-900',
        badgeBg: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30',
        badgeText: 'E-Wallet',
      };
    }
    if (nameLower.includes('cash') || nameLower.includes('tunai') || acc.icon === '💵') {
      return {
        gradient: 'from-slate-800 via-slate-700 to-zinc-900',
        badgeBg: 'bg-slate-400/20 text-slate-200 border-slate-400/30',
        badgeText: 'Tunai',
      };
    }

    return {
      gradient: 'from-slate-900 via-blue-950 to-slate-900',
      badgeBg: 'bg-blue-400/20 text-blue-200 border-blue-400/30',
      badgeText: 'Rekening',
    };
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto no-scrollbar flex gap-3 snap-x snap-mandatory py-1 px-5">
        {accounts.map((acc, index) => {
          const style = getCardStyle(acc);
          const isLiability = acc.kind === 'liability';
          const debt = isLiability ? getAccountDebt(acc) : 0;
          const isSelected = selectedIndex === index;

          return (
            <div
              key={acc.id}
              onClick={() => {
                playHapticSound('tap');
                onSelectIndex(index);
              }}
              className={`min-w-[260px] sm:min-w-[280px] snap-center rounded-2xl p-4 text-white shadow-md cursor-pointer transition-all duration-200 hover:scale-[1.01] bg-gradient-to-br ${style.gradient} relative overflow-hidden border ${
                isSelected ? 'border-white/50 ring-2 ring-white/20' : 'border-white/10'
              }`}
            >
              {/* Header: Icon, Name & Type Badge */}
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-sm font-bold shrink-0">
                    {acc.icon || (isLiability ? '💳' : '🏦')}
                  </div>
                  <span className="text-xs font-bold truncate text-white">
                    {acc.name}
                  </span>
                </div>

                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.badgeBg} shrink-0`}>
                  {style.badgeText}
                </span>
              </div>

              {/* Main: Balance / Debt Amount */}
              <div className="my-2">
                <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider block">
                  {isLiability ? 'Tagihan Saat Ini' : 'Saldo Akun'}
                </span>
                <div
                  className={`text-lg sm:text-xl font-extrabold tracking-tight mt-0.5 ${
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
                </div>
              </div>

              {/* Footer row: Extra contextual details */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-slate-300/80">
                <span>
                  {isLiability && acc.dueDay
                    ? `Jatuh tempo: Tgl ${acc.dueDay}`
                    : isLiability
                    ? 'Kewajiban / Tagihan'
                    : 'Uang Tersedia'}
                </span>
                <span className="text-white/60 text-[9px] font-mono">
                  {isSelected ? '● Aktif' : 'Pilih'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
