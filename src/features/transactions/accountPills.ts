import type { Account } from '../../lib/schemas';

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
