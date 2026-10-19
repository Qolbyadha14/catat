import type { Account } from './schemas';

export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netBalance: number;
  assetAccounts: Account[];
  liabilityAccounts: Account[];
  hasLiabilities: boolean;
}

export function getAccountDebt(account: Account): number {
  if (account.kind !== 'liability') return 0;
  return account.balance < 0 ? Math.abs(account.balance) : 0;
}

export function calculateAccountSummary(accounts: Account[]): AccountSummary {
  const active = accounts.filter((a) => !a.isArchived);
  const assetAccounts = active.filter((a) => a.kind === 'asset');
  const liabilityAccounts = active.filter((a) => a.kind === 'liability');

  const totalAssets = assetAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalLiabilities = liabilityAccounts.reduce(
    (sum, a) => sum + getAccountDebt(a),
    0
  );

  return {
    totalAssets,
    totalLiabilities,
    netBalance: totalAssets - totalLiabilities,
    assetAccounts,
    liabilityAccounts,
    hasLiabilities: liabilityAccounts.length > 0,
  };
}
