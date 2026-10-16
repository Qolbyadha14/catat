import { useAuth } from './features/auth/useAuth';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';

export default function App() {
  const { user, loading, error, signInWithGoogle, signOut } = useAuth();

  return (
    <div className="app-viewport">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted-foreground)' }}>
          <span>Memuat Catat...</span>
        </div>
      ) : !user ? (
        <div className="app-container">
          <LoginView onSignIn={signInWithGoogle} loading={loading} error={error} />
        </div>
      ) : (
        <DashboardView user={user} onSignOut={signOut} />
      )}
    </div>
  );
}
