import { filterSelectableAccounts, getAccountKindBadge } from './AccountPillSelector';
import type { Account } from '../../lib/schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

const mockAccounts: Account[] = [
  { id: 'a1', name: 'Bank Jago', kind: 'asset', balance: 1500000, createdAt: 1, isArchived: false },
  { id: 'a2', name: 'SPayLater', kind: 'liability', balance: -250000, createdAt: 1, isArchived: false },
  { id: 'a3', name: 'Old Bank', kind: 'asset', balance: 0, createdAt: 1, isArchived: true },
];

// Test 1: filters out archived and excluded accounts
const selectable = filterSelectableAccounts(mockAccounts, 'a1');
assert(selectable.length === 1 && selectable[0].id === 'a2', 'excludes archived and excludeId');

// Test 2: all non-archived when no excludeId
const allActive = filterSelectableAccounts(mockAccounts);
assert(allActive.length === 2, 'returns all active accounts when no excludeId');

// Test 3: badges
const assetBadge = getAccountKindBadge('asset');
assert(assetBadge.label === 'Kas', 'asset badge is Kas');
assert(assetBadge.className.includes('asset'), 'asset badge className is asset');

const liabilityBadge = getAccountKindBadge('liability');
assert(liabilityBadge.label === 'PayLater', 'liability badge is PayLater');
assert(liabilityBadge.className.includes('liability'), 'liability badge className is liability');

console.log('AccountPillSelector logic tests pass');
