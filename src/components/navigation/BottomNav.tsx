import React from 'react';
import { Home, Wallet, Target, BarChart3, Plus } from 'lucide-react';
import { playHapticSound } from '../../lib/haptic';

export type NavTabType = 'dashboard' | 'accounts' | 'budgets' | 'stats';

export interface BottomNavProps {
  currentTab: NavTabType;
  onChangeTab: (tab: NavTabType) => void;
  onOpenAddModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  onOpenAddModal,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md sm:max-w-lg md:max-w-xl mx-auto px-4 pb-4 pt-1 pointer-events-none">
      <nav className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12)] px-3 py-2 flex items-center justify-between">
        {/* Tab 1: Beranda */}
        <button
          type="button"
          onClick={() => {
            playHapticSound('tap');
            onChangeTab('dashboard');
          }}
          className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
            currentTab === 'dashboard' ? 'text-blue-600 scale-105 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`}
          aria-label="Beranda"
        >
          <Home size={20} strokeWidth={currentTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[10px]">Beranda</span>
        </button>

        {/* Tab 2: Dompet */}
        <button
          type="button"
          onClick={() => {
            playHapticSound('tap');
            onChangeTab('accounts');
          }}
          className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
            currentTab === 'accounts' ? 'text-blue-600 scale-105 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`}
          aria-label="Dompet & PayLater"
        >
          <Wallet size={20} strokeWidth={currentTab === 'accounts' ? 2.5 : 2} />
          <span className="text-[10px]">Dompet</span>
        </button>

        {/* Center Floating (+) Add Transaction Button */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            type="button"
            onClick={() => {
              playHapticSound('success');
              onOpenAddModal();
            }}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35 hover:scale-110 active:scale-95 transition-all cursor-pointer border-4 border-white"
            title="Catat Transaksi Baru"
            aria-label="Catat Transaksi Baru"
          >
            <Plus size={26} strokeWidth={3} />
          </button>
        </div>

        {/* Tab 3: Anggaran */}
        <button
          type="button"
          onClick={() => {
            playHapticSound('tap');
            onChangeTab('budgets');
          }}
          className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
            currentTab === 'budgets' ? 'text-blue-600 scale-105 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`}
          aria-label="Anggaran Bulanan"
        >
          <Target size={20} strokeWidth={currentTab === 'budgets' ? 2.5 : 2} />
          <span className="text-[10px]">Anggaran</span>
        </button>

        {/* Tab 4: Statistik */}
        <button
          type="button"
          onClick={() => {
            playHapticSound('tap');
            onChangeTab('stats');
          }}
          className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
            currentTab === 'stats' ? 'text-blue-600 scale-105 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`}
          aria-label="Statistik & Analisis"
        >
          <BarChart3 size={20} strokeWidth={currentTab === 'stats' ? 2.5 : 2} />
          <span className="text-[10px]">Statistik</span>
        </button>
      </nav>
    </div>
  );
};
