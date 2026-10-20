import React from 'react';
import { Search, Users } from 'lucide-react';
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
    <header className="px-5 py-3 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100/80">
      <div className="flex items-center justify-between gap-3">
        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm ring-2 ring-blue-500/20 shadow-xs">
                {userInitials}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 leading-tight">Selamat Datang,</div>
            <div className="text-sm font-bold text-slate-900 tracking-tight truncate max-w-[150px]">{userName}</div>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-2">
          {/* Family Ledger Switch Button */}
          <button
            type="button"
            onClick={() => {
              playHapticSound('click');
              onOpenFamilyLedger();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              activeLedgerName
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-slate-200/80 hover:bg-slate-200'
            }`}
            title={activeLedgerName ? `Buku Kas: ${activeLedgerName}` : 'Buku Kas Keluarga'}
            aria-label="Buku Kas Keluarga"
          >
            <Users size={14} className={activeLedgerName ? 'text-blue-600' : 'text-slate-500'} />
            <span className="text-[11px] font-bold max-w-[85px] truncate">
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
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer border border-slate-200/60"
            title="Cari Transaksi"
            aria-label="Cari Transaksi"
          >
            <Search size={16} />
          </button>

          {/* Profile / Settings Trigger */}
          <button
            type="button"
            onClick={() => {
              playHapticSound('tap');
              onOpenProfileMenu();
            }}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer border border-slate-200/60 relative"
            title="Menu Profil & Pengaturan"
            aria-label="Menu Profil & Pengaturan"
            aria-expanded={isProfileMenuOpen}
          >
            <span className="text-xs font-black">{userInitials}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
