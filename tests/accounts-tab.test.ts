import { describe, it, expect } from 'bun:test';
import type { Account } from '../src/lib/schemas';
import { calculateAccountSummary } from '../src/lib/accountCalculations';
import { AccountsTab } from '../src/features/accounts/AccountsTab';

describe('AccountsTab', () => {
  it('correctly splits assets and liabilities', () => {
    const mockAccounts: Account[] = [
      { id: '1', name: 'BCA', kind: 'asset', balance: 5000000, isArchived: false, createdAt: 1 },
      { id: '2', name: 'Shopee PayLater', kind: 'liability', balance: -1500000, isArchived: false, createdAt: 1 },
    ];
    const summary = calculateAccountSummary(mockAccounts);
    expect(summary.totalAssets).toBe(5000000);
    expect(summary.totalLiabilities).toBe(1500000);
    expect(summary.netBalance).toBe(3500000);
  });

  it('exports AccountsTab cleanly', () => {
    expect(AccountsTab).toBeDefined();
  });
});
