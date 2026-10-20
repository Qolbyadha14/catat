import { useState } from 'react';
import { Receipt, Users, TrendingUp, Lock, Loader2 } from 'lucide-react';
import { playHapticSound } from '../../lib/haptic';

interface LoginViewProps {
  onSignIn: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function LoginView({ onSignIn, loading, error }: LoginViewProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    try {
      playHapticSound('click');
      setSubmitting(true);
      await onSignIn();
    } catch {
      // Error handled via props
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = loading || submitting;

  return (
    <main className="w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col items-center text-center relative z-10 animate-in fade-in zoom-in-95 duration-200">
      {/* Top Accent Badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 text-[11px] font-bold tracking-tight mb-3.5 shadow-2xs">
        <span>✨</span>
        <span>v2.0 • Pintar & Kolaboratif</span>
      </div>

      {/* Official Brand Logo */}
      <picture className="mb-2 block">
        <source media="(prefers-color-scheme: dark)" srcSet="/brand/catat-logo-dark.svg" />
        <img
          src="/brand/catat-logo.svg"
          alt="catat by coreboylabs"
          className="w-48 sm:w-52 max-w-full h-auto mx-auto"
        />
      </picture>

      {/* Slogan */}
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight mb-6 max-w-xs mx-auto">
        Catat keuangan, hidup lebih tenang.
      </p>

      {/* 3 Core Value Proposition Highlights */}
      <div className="w-full space-y-2.5 mb-6 text-left">
        {/* 1. AI OCR Scanner */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 transition-all hover:bg-slate-100/70 dark:hover:bg-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
            <Receipt size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Scan Struk Berbasis AI
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Ekstraksi transaksi instan tanpa ketik manual
            </div>
          </div>
        </div>

        {/* 2. Family Ledger */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 transition-all hover:bg-slate-100/70 dark:hover:bg-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
            <Users size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Buku Kas Bersama
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Sinkronisasi real-time bersama pasangan & keluarga
            </div>
          </div>
        </div>

        {/* 3. Debt & PayLater */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 transition-all hover:bg-slate-100/70 dark:hover:bg-slate-800">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-2xs">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Arus Kas & PayLater
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Pantau jatuh tempo tagihan & anggaran bulanan
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="w-full mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-medium text-center animate-in fade-in">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Primary Google Sign-In Action */}
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isBusy}
        className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-sm flex items-center justify-center gap-3 shadow-md shadow-slate-900/10 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-98 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none"
      >
        {isBusy ? (
          <>
            <Loader2 size={18} className="animate-spin text-white dark:text-slate-950" />
            <span>Menghubungkan ke Google...</span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
              />
            </svg>
            <span>Masuk dengan Google</span>
          </>
        )}
      </button>

      {/* Security Trust Signals & Attribution */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 w-full flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <Lock size={12} className="text-emerald-500 shrink-0" />
          <span>Data terenkripsi & tersimpan aman di cloud Firebase</span>
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          Crafted with care by CoreboyLabs
        </div>
      </div>
    </main>
  );
}
