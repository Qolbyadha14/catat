import React from 'react';
import { Home, Wallet, Target, BarChart3, Plus, type LucideIcon } from 'lucide-react';
import { playHapticSound } from '../../lib/haptic';

export type NavTabType = 'dashboard' | 'accounts' | 'budgets' | 'stats';

export interface BottomNavProps {
  currentTab: NavTabType;
  onChangeTab: (tab: NavTabType) => void;
  onOpenAddModal: () => void;
}

interface NavTab {
  id: NavTabType;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
}

const LEFT_TABS: NavTab[] = [
  { id: 'dashboard', label: 'Beranda', ariaLabel: 'Beranda', Icon: Home },
  { id: 'accounts', label: 'Dompet', ariaLabel: 'Dompet & PayLater', Icon: Wallet },
];

const RIGHT_TABS: NavTab[] = [
  { id: 'budgets', label: 'Anggaran', ariaLabel: 'Anggaran Bulanan', Icon: Target },
  { id: 'stats', label: 'Statistik', ariaLabel: 'Statistik & Analisis', Icon: BarChart3 },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  onOpenAddModal,
}) => {
  const renderTab = ({ id, label, ariaLabel, Icon }: NavTab) => {
    const isActive = currentTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          playHapticSound('tap');
          onChangeTab(id);
        }}
        className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
          isActive
            ? 'text-blue-700 dark:text-blue-300 font-bold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
        aria-label={ariaLabel}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
        <span className="text-[11px] leading-none">{label}</span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md sm:max-w-lg md:max-w-xl mx-auto px-4 pb-4 pt-1 pointer-events-none">
      <nav
        aria-label="Navigasi utama"
        className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12)] px-3 py-1 flex items-center justify-between"
      >
        {LEFT_TABS.map(renderTab)}

        {/* Center Floating (+) Add Transaction Button */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            type="button"
            onClick={() => {
              playHapticSound('success');
              onOpenAddModal();
            }}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35 hover:scale-110 active:scale-95 transition-all cursor-pointer border-4 border-white dark:border-slate-900"
            title="Catat Transaksi Baru"
            aria-label="Catat Transaksi Baru"
          >
            <Plus size={26} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>

        {RIGHT_TABS.map(renderTab)}
      </nav>
    </div>
  );
};
