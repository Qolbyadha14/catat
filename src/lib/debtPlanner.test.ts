import {
  getLiabilityAccountsWithDebt,
  sortDebtsByStrategy,
  calculateDebtPlan,
} from './debtPlanner';
import type { Account } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const mockAccounts: Account[] = [
  { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 500000, isArchived: false, createdAt: 1 },
  { id: 'acc_shopee', name: 'Shopee PayLater', kind: 'liability', balance: -1500000, isArchived: false, createdAt: 2 },
  { id: 'acc_tiktok', name: 'TikTok PayLater', kind: 'liability', balance: -500000, isArchived: false, createdAt: 3 },
  { id: 'acc_cimb_kta', name: 'CIMB Niaga KTA', kind: 'liability', balance: -10000000, isArchived: false, createdAt: 4 },
  { id: 'acc_bca_cc', name: 'BCA CC', kind: 'liability', balance: -3000000, isArchived: false, createdAt: 5 },
  { id: 'acc_zero', name: 'Kartu Kredit Lunas', kind: 'liability', balance: 0, isArchived: false, createdAt: 6 },
  { id: 'acc_archived', name: 'Hutang Lama', kind: 'liability', balance: -2000000, isArchived: true, createdAt: 7 },
];

// 1. Test getLiabilityAccountsWithDebt
const debts = getLiabilityAccountsWithDebt(mockAccounts);
assert(debts.length === 4, 'Should only return 4 active liabilities with negative balance');
assert(!debts.some((d) => d.id === 'acc_cash'), 'Should not include asset');
assert(!debts.some((d) => d.id === 'acc_zero'), 'Should not include 0 balance');
assert(!debts.some((d) => d.id === 'acc_archived'), 'Should not include archived account');

// 2. Test Snowball sorting (smallest balance first)
const snowballSorted = sortDebtsByStrategy(debts, 'snowball');
assert(snowballSorted[0]!.id === 'acc_tiktok', 'Snowball: TikTok (500k) should be first');
assert(snowballSorted[1]!.id === 'acc_shopee', 'Snowball: Shopee (1.5M) should be second');
assert(snowballSorted[2]!.id === 'acc_bca_cc', 'Snowball: BCA CC (3M) should be third');
assert(snowballSorted[3]!.id === 'acc_cimb_kta', 'Snowball: KTA (10M) should be fourth');

// 3. Test Avalanche sorting (PayLater & KTA first, then CC)
const avalancheSorted = sortDebtsByStrategy(debts, 'avalanche');
assert(
  avalancheSorted[0]!.name.toLowerCase().includes('paylater') ||
  avalancheSorted[0]!.name.toLowerCase().includes('kta'),
  'Avalanche: high-risk / PayLater / KTA must be prioritized'
);

// 4. Test calculateDebtPlan math simulation
const fixedStartDate = new Date(2026, 9, 1); // Oct 1, 2026
const plan = calculateDebtPlan(mockAccounts, 2000000, 'snowball', fixedStartDate);
assert(plan.totalDebt === 15000000, 'Total debt must be 15,000,000');
assert(plan.items.length === 4, 'Should have 4 items in plan');
assert(plan.items[0]!.isCurrentFocus === true, 'First item must be current focus');
assert(plan.items[1]!.isCurrentFocus === false, 'Second item must not be current focus');
assert(plan.totalMonths === 8, 'At 2M/mo, 15M takes ceil(15/2) = 8 months');
assert(plan.debtFreeDate !== null, 'debtFreeDate must be computed');

// 5. Test empty / zero debt case
const zeroPlan = calculateDebtPlan([], 1000000, 'snowball', fixedStartDate);
assert(zeroPlan.totalDebt === 0, 'Zero accounts should have totalDebt = 0');
assert(zeroPlan.totalMonths === 0, 'Zero accounts should have totalMonths = 0');
assert(zeroPlan.debtFreeDate === null, 'Zero accounts should have null debtFreeDate');

console.log('debtPlanner unit tests passed');
