import { useState } from 'react';
import { useAuth } from './features/auth/useAuth';
import { useSuperAdmin } from './features/auth/useSuperAdmin';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';
import { AdminDashboardView } from './features/admin/AdminDashboardView';
import { useTheme } from './lib/theme';

export default function App() {
  useTheme();
  const { user, loading, error, signInWithGoogle, signOut } = useAuth();
  const { isSuperAdmin } = useSuperAdmin(user?.uid, user?.email);
  const [currentView, setCurrentView] = useState<'app' | 'admin'>('app');

  return (
    <div className="app-viewport">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted-foreground)' }}>
          <span>Memuat Catat...</span>
        </div>
      ) : !user ? (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <LoginView onSignIn={signInWithGoogle} loading={loading} error={error} />
        </div>
      ) : currentView === 'admin' && isSuperAdmin ? (
        <AdminDashboardView user={user} onBackToApp={() => setCurrentView('app')} />
      ) : (
        <DashboardView
          user={user}
          onSignOut={signOut}
          onOpenAdmin={isSuperAdmin ? () => setCurrentView('admin') : undefined}
        />
      )}
    </div>
  );
}

