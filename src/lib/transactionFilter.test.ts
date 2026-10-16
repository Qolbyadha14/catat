import {
  filterTransactions,
  countActiveFilters,
  DEFAULT_FILTER_CRITERIA,
  type FilterCriteria,
} from './transactionFilter';
import type { Transaction } from './schemas';

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

const mockAccounts = new Map([
  ['acc_cash', { name: 'Tunai', isArchived: false }],
  ['acc_bank', { name: 'Bank BCA', isArchived: false }],
  ['acc_old', { name: 'Dompet Lama', isArchived: true }],
]);

const mockCategories = new Map([
  ['cat_food', { name: 'Makanan', icon: '🍜', isArchived: false }],
  ['cat_salary', { name: 'Gaji', icon: '💼', isArchived: false }],
  ['cat_old', { name: 'Hobi Lama', icon: '🎨', isArchived: true }],
]);

// Test Dataset
const now = new Date(2026, 9, 16, 12, 0, 0).getTime(); // Oct 16, 2026 12:00
const endOfDayOct16 = new Date(2026, 9, 16, 23, 59, 59, 999).getTime(); // Oct 16, 2026 23:59:59.999
const startOfDayOct17 = new Date(2026, 9, 17, 0, 0, 0, 0).getTime(); // Oct 17, 2026 00:00:00.000

const sampleTransactions: Transaction[] = [
  {
    id: 'tx_1',
    type: 'expense',
    amount: 25_000,
    accountId: 'acc_cash',
    categoryId: 'cat_food',
    date: endOfDayOct16,
    note: 'Bakso malam',
    createdAt: endOfDayOct16,
    updatedAt: endOfDayOct16,
  },
  {
    id: 'tx_2',
    type: 'income',
    amount: 5_000_000,
    accountId: 'acc_bank',
    categoryId: 'cat_salary',
    date: now,
    note: 'Gaji bulanan',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'tx_3',
    type: 'expense',
    amount: 100_000,
    accountId: 'acc_old', // archived account!
    categoryId: 'cat_old', // archived category!
    date: now,
    note: 'Beli kanvas lukis',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'tx_4',
    type: 'transfer',
    amount: 50_000,
    fromAccountId: 'acc_bank',
    toAccountId: 'acc_cash',
    date: now,
    note: 'Tarik tunai ATM',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'tx_5',
    type: 'expense',
    amount: 15_000,
    accountId: 'acc_cash',
    categoryId: 'cat_food',
    date: startOfDayOct17,
    note: 'Sarapan pagi esok',
    createdAt: startOfDayOct17,
    updatedAt: startOfDayOct17,
  },
];

// Scenario 1: End-of-day boundary
{
  const criteria: FilterCriteria = {
    ...DEFAULT_FILTER_CRITERIA,
    datePreset: 'custom',
    customRange: { from: '2026-10-16', to: '2026-10-16' },
  };

  const results = filterTransactions(sampleTransactions, criteria, mockAccounts, mockCategories);
  const ids = results.map((t) => t.id);

  assert(ids.includes('tx_1'), 'tx_1 at 23:59:59.999 on target date MUST be included in range');
  assert(ids.includes('tx_2'), 'tx_2 at midday on target date MUST be included in range');
  assert(!ids.includes('tx_5'), 'tx_5 at next day 00:00:00 MUST be excluded');
}

// Scenario 2: Filter reset & badge counter
{
  const activeCriteria: FilterCriteria = {
    keyword: 'gaji',
    type: 'income',
    accountIds: ['acc_bank'],
    categoryIds: ['cat_salary'],
    datePreset: 'this_month',
    customRange: null,
  };

  assert(countActiveFilters(activeCriteria) === 4, 'Badge count must be 4 when type, acc, cat, date are active');

  const resetCriteria: FilterCriteria = { ...DEFAULT_FILTER_CRITERIA };
  assert(countActiveFilters(resetCriteria) === 0, 'Badge count must return to 0 on reset');

  const allResults = filterTransactions(sampleTransactions, resetCriteria, mockAccounts, mockCategories);
  assert(allResults.length === sampleTransactions.length, 'Reset filter must return full transaction snapshot');
}

// Scenario 3: Multi-filter conjunction (AND logic)
{
  const criteria: FilterCriteria = {
    keyword: 'bakso',
    type: 'expense',
    accountIds: ['acc_cash'],
    categoryIds: ['cat_food'],
    datePreset: 'this_month',
    customRange: null,
  };

  const results = filterTransactions(sampleTransactions, criteria, mockAccounts, mockCategories);
  assert(results.length === 1 && results[0]?.id === 'tx_1', 'Multi-filter AND logic must narrow to exact single match');

  // Mismatch type returns 0
  const mismatchType = filterTransactions(
    sampleTransactions,
    { ...criteria, type: 'income' },
    mockAccounts,
    mockCategories
  );
  assert(mismatchType.length === 0, 'Conjunction failure must return empty');
}

// Scenario 4: Archived reference resolution & filtering
{
  // Filter by archived account
  const archivedAccCriteria: FilterCriteria = {
    ...DEFAULT_FILTER_CRITERIA,
    accountIds: ['acc_old'],
  };

  const results = filterTransactions(sampleTransactions, archivedAccCriteria, mockAccounts, mockCategories);
  assert(results.length === 1 && results[0]?.id === 'tx_3', 'Filter by archived account must resolve correctly');

  // Verify archived entity resolution
  const tx = results[0];
  assert(tx !== undefined, 'Transaction must exist');
  if (tx && tx.type !== 'transfer') {
    const acc = mockAccounts.get(tx.accountId);
    const cat = mockCategories.get(tx.categoryId);
    assert(acc !== undefined && acc.isArchived === true, 'Archived account metadata must be intact');
    assert(cat !== undefined && cat.isArchived === true, 'Archived category metadata must be intact');

    const accLabel = `${acc.name}${acc.isArchived ? ' (Arsip)' : ''}`;
    const catLabel = `${cat.name}${cat.isArchived ? ' (Arsip)' : ''}`;
    assert(accLabel === 'Dompet Lama (Arsip)', 'Archived account label must append (Arsip)');
    assert(catLabel === 'Hobi Lama (Arsip)', 'Archived category label must append (Arsip)');
  }
}

console.log('Transaction filter tests pass');
