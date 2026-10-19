import { computeCategoryBreakdown } from './categoryBreakdown';
import type { Transaction } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const mockCategories = new Map([
  ['cat_food', { name: 'Makan & Minum', icon: '🍔', isArchived: false }],
  ['cat_transport', { name: 'Transportasi', icon: '🚗', isArchived: false }],
  ['cat_old', { name: 'Koleksi CD', icon: '💿', isArchived: true }],
]);

const baseTime = new Date(2026, 9, 1).getTime(); // Oct 1, 2026
const nextMonth = new Date(2026, 10, 1).getTime(); // Nov 1, 2026

// 1. Division by zero safety: zero transactions or total expense 0
{
  const res = computeCategoryBreakdown([], mockCategories, baseTime, nextMonth);
  assert(res.totalExpense === 0, 'Total expense must be 0');
  assert(res.items.length === 0, 'Items must be empty array');
}

// 2. Only expenses in active month count, income & transfer ignored
{
  const txs: Transaction[] = [
    {
      id: 'tx1',
      type: 'expense',
      amount: 100_000,
      accountId: 'acc1',
      categoryId: 'cat_food',
      note: '',
      date: new Date(2026, 9, 15).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'tx2',
      type: 'income',
      amount: 500_000,
      accountId: 'acc1',
      categoryId: 'cat_food',
      note: '',
      date: new Date(2026, 9, 15).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'tx3',
      type: 'transfer',
      amount: 50_000,
      fromAccountId: 'acc1',
      toAccountId: 'acc2',
      note: '',
      date: new Date(2026, 9, 15).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'tx4',
      type: 'expense',
      amount: 200_000,
      accountId: 'acc1',
      categoryId: 'cat_food',
      note: '',
      date: new Date(2026, 8, 20).getTime(), // previous month
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  const res = computeCategoryBreakdown(txs, mockCategories, baseTime, nextMonth);
  assert(res.totalExpense === 100_000, 'Only active month expense should be counted');
  assert(res.items.length === 1, 'Only 1 category item');
  assert(res.items[0]?.percentage === 100, 'Single category must be 100%');
}

// 3. Multi-category grouping, percentages and descending sort
{
  const txs: Transaction[] = [
    {
      id: 'tx1',
      type: 'expense',
      amount: 100_000,
      accountId: 'acc1',
      categoryId: 'cat_food',
      note: '',
      date: new Date(2026, 9, 10).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'tx2',
      type: 'expense',
      amount: 300_000,
      accountId: 'acc1',
      categoryId: 'cat_transport',
      note: '',
      date: new Date(2026, 9, 12).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  const res = computeCategoryBreakdown(txs, mockCategories, baseTime, nextMonth);
  assert(res.totalExpense === 400_000, 'Total expense must sum to 400k');
  assert(res.items.length === 2, 'Should have 2 categories');
  assert(res.items[0]?.categoryId === 'cat_transport', 'Higher expense should sort first');
  assert(res.items[0]?.percentage === 75, '300k / 400k must be 75%');
  assert(res.items[1]?.categoryId === 'cat_food', 'Lower expense should sort second');
  assert(res.items[1]?.percentage === 25, '100k / 400k must be 25%');
}

// 4. Archived category label resolution
{
  const txs: Transaction[] = [
    {
      id: 'tx1',
      type: 'expense',
      amount: 50_000,
      accountId: 'acc1',
      categoryId: 'cat_old',
      note: '',
      date: new Date(2026, 9, 5).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  const res = computeCategoryBreakdown(txs, mockCategories, baseTime, nextMonth);
  assert(res.items[0]?.categoryName === 'Koleksi CD (Arsip)', 'Archived category must include (Arsip) label');
  assert(res.items[0]?.isArchived === true, 'isArchived must be true');
}

// 5. Fallback for unmapped category
{
  const txs: Transaction[] = [
    {
      id: 'tx1',
      type: 'expense',
      amount: 50_000,
      accountId: 'acc1',
      categoryId: 'cat_unknown',
      note: '',
      date: new Date(2026, 9, 5).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  const res = computeCategoryBreakdown(txs, mockCategories, baseTime, nextMonth);
  assert(res.items[0]?.categoryName === 'Tanpa Kategori', 'Unmapped category should fallback to Tanpa Kategori');
  assert(res.items[0]?.categoryIcon === '🏷️', 'Fallback icon');
}

// 6. Smart Budgeting progress integration
{
  const categoriesWithBudget = new Map([
    ['cat_food', { name: 'Makan & Minum', icon: '🍔', isArchived: false, monthlyBudget: 1_000_000 }],
    ['cat_bills', { name: 'Tagihan', icon: '⚡', isArchived: false, monthlyBudget: 500_000 }],
  ]);

  const txs: Transaction[] = [
    {
      id: 'tx1',
      type: 'expense',
      amount: 400_000,
      accountId: 'acc1',
      categoryId: 'cat_food',
      note: '',
      date: new Date(2026, 9, 5).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'tx2',
      type: 'expense',
      amount: 600_000,
      accountId: 'acc1',
      categoryId: 'cat_bills',
      note: '',
      date: new Date(2026, 9, 10).getTime(),
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  const res = computeCategoryBreakdown(txs, categoriesWithBudget, baseTime, nextMonth);
  const foodItem = res.items.find((i) => i.categoryId === 'cat_food');
  const billsItem = res.items.find((i) => i.categoryId === 'cat_bills');

  assert(foodItem?.monthlyBudget === 1_000_000, 'foodItem monthlyBudget is 1000000');
  assert(foodItem?.budgetStatus === 'safe', 'foodItem (40%) is safe');
  assert(foodItem?.budgetRemaining === 600_000, 'foodItem remaining is 600000');
  assert(foodItem?.budgetPercentage === 40, 'foodItem percentage is 40%');

  assert(billsItem?.monthlyBudget === 500_000, 'billsItem monthlyBudget is 500000');
  assert(billsItem?.budgetStatus === 'exceeded', 'billsItem (120%) is exceeded');
  assert(billsItem?.overbudgetAmount === 100_000, 'billsItem overbudget by 100000');
}

console.log('Category breakdown tests pass');

