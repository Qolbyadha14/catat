import { describe, it, expect } from 'bun:test';
import { calculateAccountSummary, getAccountDebt } from './accountCalculations';
import type { Account } from './schemas';

describe('accountCalculations', () => {
  const accounts: Account[] = [
    { id: '1', name: 'Kas', kind: 'asset', balance: 500000, isArchived: false, createdAt: 1 },
    { id: '2', name: 'BCA', kind: 'asset', balance: 2500000, isArchived: false, createdAt: 2 },
    { id: '3', name: 'SPayLater', kind: 'liability', balance: -450000, isArchived: false, createdAt: 3 },
    { id: '4', name: 'GoPay Later', kind: 'liability', balance: 0, isArchived: false, createdAt: 4 },
    { id: '5', name: 'Old Account', kind: 'asset', balance: 100000, isArchived: true, createdAt: 5 },
  ];

  it('calculates getAccountDebt correctly', () => {
    expect(getAccountDebt(accounts[2]!)).toBe(450000);
    expect(getAccountDebt(accounts[3]!)).toBe(0);
    expect(getAccountDebt(accounts[0]!)).toBe(0);
  });

  it('calculates summary excluding archived accounts', () => {
    const summary = calculateAccountSummary(accounts);
    expect(summary.totalAssets).toBe(3000000); // 500k + 2.5m (excludes archived 100k)
    expect(summary.totalLiabilities).toBe(450000);
    expect(summary.netBalance).toBe(2550000); // 3m - 450k
    expect(summary.assetAccounts.length).toBe(2);
    expect(summary.liabilityAccounts.length).toBe(2);
    expect(summary.hasLiabilities).toBe(true);
  });

  it('handles accounts with zero liabilities', () => {
    const assetOnly: Account[] = [
      { id: '1', name: 'Kas', kind: 'asset', balance: 100000, isArchived: false, createdAt: 1 },
    ];
    const summary = calculateAccountSummary(assetOnly);
    expect(summary.totalAssets).toBe(100000);
    expect(summary.totalLiabilities).toBe(0);
    expect(summary.netBalance).toBe(100000);
    expect(summary.hasLiabilities).toBe(false);
  });
});
