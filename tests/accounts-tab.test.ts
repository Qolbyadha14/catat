import { describe, it, expect } from 'bun:test';
import type { Account } from '../src/lib/schemas';
import { calculateAccountSummary } from '../src/lib/accountCalculations';
import { AccountsTab } from '../src/features/accounts/AccountsTab';
import { AccountCardCarousel } from '../src/features/accounts/AccountCardCarousel';

describe('AccountsTab and AccountCardCarousel', () => {
  it('correctly splits assets and liabilities', () => {
    const mockAccounts: Account[] = [
      { id: '1', name: 'BCA', type: 'bank', kind: 'asset', balance: 5000000, isArchived: false },
      { id: '2', name: 'Shopee PayLater', type: 'liability', kind: 'liability', balance: -1500000, isArchived: false, creditLimit: 5000000 },
    ];
    const summary = calculateAccountSummary(mockAccounts);
    expect(summary.totalAssets).toBe(5000000);
    expect(summary.totalLiabilities).toBe(1500000);
    expect(summary.netBalance).toBe(3500000);
  });

  it('exports AccountsTab and AccountCardCarousel cleanly', () => {
    expect(AccountsTab).toBeDefined();
    expect(AccountCardCarousel).toBeDefined();
  });
});
