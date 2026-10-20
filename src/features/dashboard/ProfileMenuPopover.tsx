import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { ThemeMode } from '../../lib/theme';

interface ProfileMenuPopoverProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onOpenManage: () => void;
  onSignOut: () => Promise<void>;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export function ProfileMenuPopover({
  user,
  isOpen,
  onClose,
  onOpenManage,
  onSignOut,
  theme,
  onThemeChange,
}: ProfileMenuPopoverProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = user.displayName || user.email?.split('@')[0] || 'Pengguna';
  const initial = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="profile-popover-backdrop" onClick={onClose}>
      <div
        className="profile-popover-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Menu Profil & Pengaturan"
      >
        {/* User Card */}
        <div className="profile-user-card">
          <div className="profile-user-avatar">
            {initial}
          </div>
          <div className="profile-user-details">
            <div className="profile-user-name">{displayName}</div>
            <div className="profile-user-email">{user.email || 'Mode Tamu'}</div>
          </div>
        </div>

        <div className="profile-popover-divider" />

        {/* Action: Manage Accounts & Categories */}
        <button
          type="button"
          className="profile-menu-row-btn"
          onClick={() => {
            onClose();
            onOpenManage();
          }}
        >
          <span className="profile-menu-icon" aria-hidden="true">⚙️</span>
          <div className="profile-menu-text">
            <span className="profile-menu-title">Kelola Akun & Kategori</span>
            <span className="profile-menu-desc">Tambah bank, e-wallet, paylater, atau kategori</span>
          </div>
          <span className="profile-menu-chevron" aria-hidden="true">›</span>
        </button>

        <div className="profile-popover-divider" />

        {/* Theme Segmented Switcher */}
        <div className="profile-theme-section">
          <div className="profile-section-label">Tema Tampilan</div>
          <div className="profile-theme-toggle-group">
            <button
              type="button"
              className={`profile-theme-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => onThemeChange('system')}
              title="Ikuti tema perangkat"
            >
              <span className="theme-btn-icon">🌓</span>
              <span>Sistem</span>
            </button>
            <button
              type="button"
              className={`profile-theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => onThemeChange('light')}
              title="Tema terang"
            >
              <span className="theme-btn-icon">☀️</span>
              <span>Terang</span>
            </button>
            <button
              type="button"
              className={`profile-theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeChange('dark')}
              title="Tema gelap"
            >
              <span className="theme-btn-icon">🌙</span>
              <span>Gelap</span>
            </button>
          </div>
        </div>

        <div className="profile-popover-divider" />

        {/* Sign Out Button */}
        <button
          type="button"
          className="profile-signout-btn"
          onClick={async () => {
            onClose();
            await onSignOut();
          }}
        >
          <span className="profile-menu-icon" aria-hidden="true">🚪</span>
          <span>Keluar Akun</span>
        </button>

        {/* Brand Identity Footer */}
        <div className="pt-3 pb-1 flex flex-col items-center justify-center border-t border-slate-100 dark:border-slate-800/60 mt-2">
          <picture className="opacity-75 hover:opacity-100 transition-opacity">
            <source media="(prefers-color-scheme: dark)" srcSet="/brand/catat-logo-dark.svg" />
            <img
              src="/brand/catat-logo.svg"
              alt="catat by coreboylabs"
              className="h-5 w-auto"
            />
          </picture>
          <span className="text-[10px] text-slate-400 mt-1 font-medium">v2.0 • Catat keuangan, hidup lebih tenang</span>
        </div>
      </div>
    </div>
  );
}
