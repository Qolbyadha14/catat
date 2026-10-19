import { useState, useRef, useEffect, type FormEvent } from 'react';
import type { Ledger } from '../../lib/schemas';
import { joinLedgerByCode } from '../../lib/ledgerService';

interface JoinLedgerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  currentUser: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  };
  onJoinSuccess: (ledger: Ledger) => void;
}

export function JoinLedgerDialog({
  isOpen,
  onClose,
  initialCode = '',
  currentUser,
  onJoinSuccess,
}: JoinLedgerDialogProps) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode.toUpperCase().trim());
    }
  }, [initialCode]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        inputRef.current?.focus();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 6) {
      setError('Masukkan 6 karakter kode undangan');
      return;
    }

    try {
      setLoading(true);
      const joinedLedger = await joinLedgerByCode(cleanCode, currentUser);
      onJoinSuccess(joinedLedger);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal bergabung ke buku kas.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^2-9A-Z]/g, '').slice(0, 8);
    setCode(clean);
    if (error) setError(null);
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="join-ledger-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="join-ledger-content">
        <div className="join-ledger-header">
          <div className="join-ledger-icon">🔑</div>
          <h3 className="join-ledger-title">Gabung Buku Kas Keluarga</h3>
          <p className="join-ledger-desc">
            Masukkan kode undangan 6 karakter yang dibagikan oleh anggota keluargamu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="join-ledger-form">
          {error && (
            <div className="join-error-banner" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="join-code-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="join-code-input"
              value={code}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="CONTOH: KATAT8"
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              disabled={loading}
              aria-label="Kode Undangan"
            />
          </div>

          <div className="join-ledger-actions">
            <button
              type="button"
              className="btn-dialog-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-hero"
              style={{ width: 'auto', padding: '0 24px', height: 44 }}
              disabled={loading || code.trim().length < 6}
            >
              {loading ? 'Memeriksa...' : 'Gabung Buku Kas'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
