import React from 'react';
import { Search, Users, ChevronDown } from 'lucide-react';
import { playHapticSound } from '../../lib/haptic';

export interface HeaderProps {
  userName: string;
  userPhoto?: string;
  userInitials: string;
  activeLedgerName?: string | null;
  onOpenFamilyLedger: () => void;
  onOpenSearch: () => void;
  onOpenProfileMenu: () => void;
  isProfileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  userPhoto,
  userInitials,
  activeLedgerName,
  onOpenFamilyLedger,
  onOpenSearch,
  onOpenProfileMenu,
  isProfileMenuOpen,
}) => {
  return (
    <header className="px-5 py-3 sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100/90 dark:border-slate-800 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Tap-friendly User Profile (opens Profile & Settings) */}
        <button
          type="button"
          onClick={() => {
            playHapticSound('tap');
            onOpenProfileMenu();
          }}
          className="flex items-center gap-2.5 p-1 -ml-1 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800 active:scale-98 transition-all text-left cursor-pointer group select-none min-w-0"
          title="Buka Menu Profil & Pengaturan"
          aria-label="Menu Profil & Pengaturan"
          aria-expanded={isProfileMenuOpen}
        >
          <div className="relative shrink-0">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/20 group-hover:ring-blue-500/50 transition-all"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm ring-2 ring-blue-500/20 group-hover:ring-blue-500/50 shadow-xs transition-all">
                {userInitials}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
          </div>
          <div className="min-w-0 pr-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">
              Halo,
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-[120px] sm:max-w-[160px] flex items-center gap-1">
              <span>{userName}</span>
              <ChevronDown
                size={13}
                className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors shrink-0"
              />
            </div>
          </div>
        </button>

        {/* Right: Only 2 focused utility actions (Ledger Switcher + Search) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Family Ledger Switch Button */}
          <button
            type="button"
            onClick={() => {
              playHapticSound('click');
              onOpenFamilyLedger();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              activeLedgerName
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={activeLedgerName ? `Buku Kas: ${activeLedgerName}` : 'Buku Kas Keluarga'}
            aria-label="Buku Kas Keluarga"
          >
            <Users size={14} className={activeLedgerName ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'} />
            <span className="text-[11px] font-bold max-w-[95px] truncate">
              {activeLedgerName || 'Keluarga'}
            </span>
            {activeLedgerName && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            )}
          </button>

          {/* Search Trigger */}
          <button
            type="button"
            onClick={() => {
              playHapticSound('click');
              onOpenSearch();
            }}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700"
            title="Cari Transaksi"
            aria-label="Cari Transaksi"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
