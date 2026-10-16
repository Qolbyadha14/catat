import { useState } from 'react';

interface LoginViewProps {
  onSignIn: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function LoginView({ onSignIn, loading, error }: LoginViewProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    try {
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
    <div className="login-wrap">
      <div className="login-icon">💳</div>
      <h2 className="login-title">Catat Coreboy</h2>
      <p className="login-sub">Your money, under control.</p>

      {error && (
        <div className="form-error-banner" style={{ marginBottom: 16, width: '100%', maxWidth: 320 }}>
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        className="btn-google-signin"
        onClick={handleSignIn}
        disabled={isBusy}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path
            fill="var(--brand-google-blue)"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
          />
          <path
            fill="var(--brand-google-green)"
            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          />
          <path
            fill="var(--brand-google-yellow)"
            d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
          />
          <path
            fill="var(--brand-google-red)"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
          />
        </svg>
        <span>{isBusy ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
      </button>
    </div>
  );
}
