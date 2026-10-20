import React, { useState } from 'react';
import { Plus, CreditCard, Wallet, ShieldCheck, Zap } from 'lucide-react';
import type { Account } from '../../lib/schemas';
import { calculateAccountSummary, getAccountDebt } from '../../lib/accountCalculations';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';
import { AccountCardCarousel } from './AccountCardCarousel';
import { DebtPlannerCard } from '../dashboard/DebtPlannerCard';

export interface AccountsTabProps {
  accounts: Account[];
  onPayLiability: (liabilityAccount: Account) => void;
  onPayDebt: (targetAccountId: string, amount: number) => void;
  onOpenAddAccount: () => void;
}

export const AccountsTab: React.FC<AccountsTabProps> = ({
  accounts,
  onPayLiability,
  onPayDebt,
  onOpenAddAccount,
}) => {
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const accountSummary = calculateAccountSummary(activeAccounts);

  return (
    <div className="space-y-5 mb-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Dompet & Rekening</h2>
          <div className="text-[11px] font-medium text-slate-400 mt-0.5">
            Total {activeAccounts.length} Akun • Saldo Bersih: {formatIdr(accountSummary.netBalance)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playHapticSound('click');
            onOpenAddAccount();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs transition-colors cursor-pointer border border-blue-200/60"
        >
          <Plus size={14} />
          <span>Tambah Akun</span>
        </button>
      </div>

      {/* Realistic Card Carousel */}
      {activeAccounts.length > 0 && (
        <AccountCardCarousel
          accounts={activeAccounts}
          selectedIndex={selectedCardIndex}
          onSelectIndex={setSelectedCardIndex}
        />
      )}

      {/* Uang Saya (Aset) Listing */}
      <section className="px-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              💰 Uang Saya (Aset)
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {accountSummary.assetAccounts.length} Akun
            </span>
          </div>
          <span className="text-xs font-black text-slate-900">
            {formatIdr(accountSummary.totalAssets)}
          </span>
        </div>

        <div className="space-y-2">
          {accountSummary.assetAccounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                  {acc.icon || (acc.type === 'cash' ? '💵' : '🏦')}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{acc.name}</div>
                  <div className="text-[10px] text-slate-400 capitalize">{acc.type}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-extrabold text-slate-900">
                  {formatIdr(acc.balance)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PayLater & Tagihan Section */}
      {accountSummary.liabilityAccounts.length > 0 && (
        <section className="px-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                💳 PayLater & Tagihan
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                {accountSummary.liabilityAccounts.length} Akun
              </span>
            </div>
            <span className="text-xs font-black text-rose-600">
              {accountSummary.totalLiabilities > 0
                ? `Hutang: ${formatIdr(accountSummary.totalLiabilities)}`
                : '✓ Semua Lunas'}
            </span>
          </div>

          <div className="space-y-2">
            {accountSummary.liabilityAccounts.map((acc) => {
              const debt = getAccountDebt(acc);
              return (
                <div
                  key={acc.id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-base">
                      {acc.icon || '💳'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{acc.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {debt > 0 ? (
                          <span className="text-rose-600 font-semibold">Tagihan: {formatIdr(debt)}</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">✓ Rp 0 (Lunas)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {debt > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          playHapticSound('success');
                          onPayLiability(acc);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs shadow-rose-500/20 cursor-pointer flex items-center gap-1"
                      >
                        <Zap size={12} />
                        <span>Bayar</span>
                      </button>
                    ) : (
                      <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        Lunas
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Debt Snowball & Avalanche Strategic Planner */}
      <div className="px-5">
        <DebtPlannerCard accounts={accounts} onPayDebt={onPayDebt} />
      </div>
    </div>
  );
};
