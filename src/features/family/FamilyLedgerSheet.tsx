import { useState } from 'react';
import type { Ledger } from '../../lib/schemas';
import { formatWhatsAppInviteText } from '../../lib/ledgerService';
import { formatDate } from '../../lib/formatters';

interface FamilyLedgerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  activeLedger: Ledger | null;
  onOpenJoinDialog: () => void;
  onSwitchToPersonal?: () => void;
  onCreateLedger?: () => Promise<void>;
  isCreating?: boolean;
}

export function FamilyLedgerSheet({
  isOpen,
  onClose,
  currentUserId,
  activeLedger,
  onOpenJoinDialog,
  onSwitchToPersonal,
  onCreateLedger,
  isCreating = false,
}: FamilyLedgerSheetProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWhatsApp = (ledger: Ledger) => {
    const text = formatWhatsAppInviteText(
      ledger.name,
      ledger.inviteCode,
      typeof window !== 'undefined' ? window.location.origin : 'https://catat-8897d.web.app'
    );
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const membersList = activeLedger ? Object.values(activeLedger.members) : [];

  return (
    <div className="sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet-content family-ledger-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="sheet-header-title-wrap">
            <h2 className="sheet-title">👥 Buku Kas Keluarga</h2>
            <span className="sheet-subtitle">
              {activeLedger ? activeLedger.name : 'Kelola keuangan bersama keluarga'}
            </span>
          </div>
          <button
            type="button"
            className="btn-sheet-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <div className="sheet-scroll-body family-sheet-body">
          {activeLedger ? (
            <>
              {/* Invite Code Card */}
              <div className="family-invite-card">
                <div className="family-invite-header">
                  <span className="family-invite-label">KODE UNDANGAN KELUARGA</span>
                  <span className="family-invite-hint">Bagikan kode ini untuk mengundang</span>
                </div>
                <div className="family-invite-code-wrap">
                  <div className="family-invite-code">{activeLedger.inviteCode}</div>
                  <button
                    type="button"
                    className="btn-copy-code"
                    onClick={() => handleCopyCode(activeLedger.inviteCode)}
                    title="Salin Kode Undangan"
                  >
                    {copied ? '✓ Tersalin!' : '📋 Salin'}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-wa-share"
                  onClick={() => handleShareWhatsApp(activeLedger)}
                >
                  <span className="btn-wa-icon">💬</span>
                  <span>Bagikan Undangan ke WhatsApp</span>
                </button>
              </div>

              {/* Members Section */}
              <div className="family-section">
                <div className="family-section-header">
                  <span className="family-section-title">
                    Anggota Keluarga ({membersList.length})
                  </span>
                </div>

                <div className="family-members-list">
                  {membersList.map((m) => {
                    const isSelf = m.uid === currentUserId;
                    const initial = (m.name || 'A').slice(0, 2).toUpperCase();
                    return (
                      <div key={m.uid} className="family-member-row">
                        <div className="family-member-avatar">
                          {m.photoURL ? (
                            <img src={m.photoURL} alt={m.name} className="avatar-img" />
                          ) : (
                            <span>{initial}</span>
                          )}
                        </div>
                        <div className="family-member-info">
                          <div className="family-member-name-wrap">
                            <span className="family-member-name">{m.name}</span>
                            {isSelf && <span className="member-self-badge">Anda</span>}
                            <span className={`member-role-badge ${m.role}`}>
                              {m.role === 'owner' ? '👑 Pemilik' : 'Anggota'}
                            </span>
                          </div>
                          <span className="family-member-joined">
                            Bergabung {formatDate(m.joinedAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="family-actions-group">
                <button
                  type="button"
                  className="btn-family-secondary"
                  onClick={() => {
                    onClose();
                    onOpenJoinDialog();
                  }}
                >
                  ➕ Gabung Buku Kas Lain
                </button>

                {onSwitchToPersonal && (
                  <button
                    type="button"
                    className="btn-family-tertiary"
                    onClick={() => {
                      onSwitchToPersonal();
                      onClose();
                    }}
                  >
                    👤 Beralih ke Buku Kas Pribadi
                  </button>
                )}
              </div>
            </>
          ) : (
            /* No Ledger Active State */
            <div className="family-empty-state">
              <div className="family-empty-icon">🏡</div>
              <h3>Mulai Buku Kas Keluarga</h3>
              <p>
                Catat belanja dan anggaran bulanan bersama pasangan atau keluarga dengan saldo,
                kategori, dan riwayat yang tersinkron otomatis.
              </p>
              <div className="family-empty-actions">
                {onCreateLedger && (
                  <button
                    type="button"
                    className="btn-hero"
                    onClick={onCreateLedger}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Membuat Buku Kas...' : '✨ Buat Buku Kas Keluarga'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-family-secondary"
                  onClick={() => {
                    onClose();
                    onOpenJoinDialog();
                  }}
                >
                  🔑 Masukkan Kode Undangan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
