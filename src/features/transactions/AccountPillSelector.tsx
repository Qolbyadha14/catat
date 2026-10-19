import type { Account } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';

export interface AccountPillSelectorProps {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  excludeId?: string;
}

export function filterSelectableAccounts(
  accounts: Account[],
  excludeId?: string
): Account[] {
  return accounts.filter((a) => !a.isArchived && (!excludeId || a.id !== excludeId));
}

export function getAccountKindBadge(kind: 'asset' | 'liability'): { label: string; className: string } {
  return kind === 'asset'
    ? { label: 'Kas', className: 'account-pill-badge-asset' }
    : { label: 'PayLater', className: 'account-pill-badge-liability' };
}

export function AccountPillSelector({
  accounts,
  selectedId,
  onSelect,
  label,
  excludeId,
}: AccountPillSelectorProps) {
  const selectableAccounts = filterSelectableAccounts(accounts, excludeId);

  if (selectableAccounts.length === 0) {
    return <div className="account-empty-state">Belum ada akun rekening aktif.</div>;
  }

  return (
    <div className="account-pill-container" role="radiogroup" aria-label={label || 'Pilih Akun'}>
      {selectableAccounts.map((acc) => {
        const isSelected = acc.id === selectedId;
        const badge = getAccountKindBadge(acc.kind);

        return (
          <button
            key={acc.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`account-pill ${isSelected ? 'active' : ''}`}
            onClick={() => onSelect(acc.id)}
            title={`${acc.name} - Saldo: ${formatIdr(acc.balance)}`}
          >
            <div className="account-pill-top">
              <span className="account-pill-icon">{acc.icon || (acc.kind === 'liability' ? '💳' : '🏦')}</span>
              <span className="account-pill-name">{acc.name}</span>
              <span className={`account-pill-kind-badge ${badge.className}`}>{badge.label}</span>
            </div>
            <div className="account-pill-balance">{formatIdr(acc.balance)}</div>
          </button>
        );
      })}
    </div>
  );
}
