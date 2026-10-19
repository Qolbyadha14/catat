import { computeWeeklyCashflow } from './weeklyCashflow';
import type { Transaction } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Year 2026, Month 10 (October, 31 days)
const year = 2026;
const month = 10;
const now = Date.now();

const mockTransactions: Transaction[] = [
  // Week 1 (Oct 3)
  {
    id: 'tx-1',
    type: 'expense',
    amount: 150000,
    accountId: 'acc-1',
    categoryId: 'food',
    note: 'Makan',
    date: new Date(2026, 9, 3).getTime(),
    createdAt: now,
    updatedAt: now,
  },
  // Week 1 (Oct 5) - Income
  {
    id: 'tx-2',
    type: 'income',
    amount: 5000000,
    accountId: 'acc-1',
    categoryId: 'salary',
    note: 'Gaji',
    date: new Date(2026, 9, 5).getTime(),
    createdAt: now,
    updatedAt: now,
  },
  // Week 2 (Oct 10) - Expense
  {
    id: 'tx-3',
    type: 'expense',
    amount: 300000,
    accountId: 'acc-1',
    categoryId: 'bill',
    note: 'Listrik',
    date: new Date(2026, 9, 10).getTime(),
    createdAt: now,
    updatedAt: now,
  },
  // Week 4 (Oct 25) - Expense
  {
    id: 'tx-4',
    type: 'expense',
    amount: 450000,
    accountId: 'acc-1',
    categoryId: 'shopping',
    note: 'Belanja',
    date: new Date(2026, 9, 25).getTime(),
    createdAt: now,
    updatedAt: now,
  },
];

const result = computeWeeklyCashflow(mockTransactions, year, month);

// 1. Should produce 5 weeks for October (31 days)
assert(result.weeks.length === 5, 'October should have 5 weeks');
const w1 = result.weeks[0];
const w2 = result.weeks[1];
const w3 = result.weeks[2];

assert(Boolean(w1 && w2 && w3), 'Weeks exist');

if (w1 && w2 && w3) {
  assert(w1.weekNumber === 1, 'First week is Week 1');
  assert(w1.dateRangeLabel === '1 - 7 Okt', 'Date range label matches');

  // 2. Week 1 income and expense
  assert(w1.income === 5000000, 'Week 1 income should be 5.000.000');
  assert(w1.expense === 150000, 'Week 1 expense should be 150.000');
  assert(w1.net === 4850000, 'Week 1 net should be 4.850.000');

  // 3. Week 2 expense
  assert(w2.expense === 300000, 'Week 2 expense should be 300.000');

  // 4. Week 3 empty
  assert(w3.expense === 0, 'Week 3 expense should be 0');
}

// 5. Peak spending week
assert(result.peakExpenseWeekNumber === 4, 'Week 4 had highest expense (450.000)');

console.log('weeklyCashflow unit tests passed');
