import { calculateAccountSummary, getAccountDebt } from './accountCalculations';
import type { Account } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

const accounts: Account[] = [
  { id: '1', name: 'Kas', kind: 'asset', balance: 500000, isArchived: false, createdAt: 1 },
  { id: '2', name: 'BCA', kind: 'asset', balance: 2500000, isArchived: false, createdAt: 2 },
  { id: '3', name: 'SPayLater', kind: 'liability', balance: -450000, isArchived: false, createdAt: 3 },
  { id: '4', name: 'GoPay Later', kind: 'liability', balance: 0, isArchived: false, createdAt: 4 },
  { id: '5', name: 'Old Account', kind: 'asset', balance: 100000, isArchived: true, createdAt: 5 },
];

// Test 1: getAccountDebt
{
  assert(getAccountDebt(accounts[2]!) === 450000, 'SPayLater debt must be 450000');
  assert(getAccountDebt(accounts[3]!) === 0, 'GoPay Later debt must be 0');
  assert(getAccountDebt(accounts[0]!) === 0, 'Kas asset debt must be 0');
}

// Test 2: calculateAccountSummary
{
  const summary = calculateAccountSummary(accounts);
  assert(summary.totalAssets === 3000000, 'totalAssets must be 3000000 (excluding archived)');
  assert(summary.totalLiabilities === 450000, 'totalLiabilities must be 450000');
  assert(summary.netBalance === 2550000, 'netBalance must be 2550000');
  assert(summary.assetAccounts.length === 2, 'active assets count must be 2');
  assert(summary.liabilityAccounts.length === 2, 'active liabilities count must be 2');
  assert(summary.hasLiabilities === true, 'hasLiabilities must be true');
}

// Test 3: zero liabilities
{
  const assetOnly: Account[] = [
    { id: '1', name: 'Kas', kind: 'asset', balance: 100000, isArchived: false, createdAt: 1 },
  ];
  const summary = calculateAccountSummary(assetOnly);
  assert(summary.totalAssets === 100000, 'totalAssets must be 100000');
  assert(summary.totalLiabilities === 0, 'totalLiabilities must be 0');
  assert(summary.netBalance === 100000, 'netBalance must be 100000');
  assert(summary.hasLiabilities === false, 'hasLiabilities must be false');
}

console.log('accountCalculations asserts pass');
