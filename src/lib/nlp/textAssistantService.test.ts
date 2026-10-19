import {
  parseIndonesianAmount,
  parseRelativeDate,
  parseTransactionLocally,
  type TextCategoryContext,
  type TextAccountContext,
} from './textAssistantService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// 1. parseIndonesianAmount tests
assert(parseIndonesianAmount('makan siang 35rb') === 35000, 'parses 35rb');
assert(parseIndonesianAmount('beli pulsa 100 rb') === 100000, 'parses 100 rb');
assert(parseIndonesianAmount('roti 12.5rb') === 12500, 'parses 12.5rb');

assert(parseIndonesianAmount('kopi susu 25k') === 25000, 'parses 25k');
assert(parseIndonesianAmount('50k bensin') === 50000, 'parses 50k');
assert(parseIndonesianAmount('croissant 22.5k') === 22500, 'parses 22.5k');

assert(parseIndonesianAmount('gaji 8.5jt') === 8500000, 'parses 8.5jt');
assert(parseIndonesianAmount('bonus 5 jt') === 5000000, 'parses 5 jt');
assert(parseIndonesianAmount('laptop 12jt') === 12000000, 'parses 12jt');

assert(parseIndonesianAmount('belanja 150.000') === 150000, 'parses 150.000');
assert(parseIndonesianAmount('transfer 1.250.000') === 1250000, 'parses 1.250.000');
assert(parseIndonesianAmount('bayar 50000') === 50000, 'parses 50000');
assert(parseIndonesianAmount('halo halo selamat sore') === null, 'returns null on non-amount');

// 2. parseRelativeDate tests
const today = new Date().toISOString().slice(0, 10);
assert(parseRelativeDate('makan padang tadi siang') === today, 'today date match');

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().slice(0, 10);
assert(parseRelativeDate('beli bensin kemarin 50rb') === yesterdayStr, 'yesterday date match');

// 3. parseTransactionLocally tests
const mockCategories: TextCategoryContext[] = [
  { id: 'cat-food', name: 'Makanan & Minuman', type: 'expense' },
  { id: 'cat-transport', name: 'Transportasi', type: 'expense' },
  { id: 'cat-salary', name: 'Gaji', type: 'income' },
  { id: 'cat-bills', name: 'Tagihan & Utilitas', type: 'expense' },
];

const mockAccounts: TextAccountContext[] = [
  { id: 'acc-bca', name: 'BCA Utama', kind: 'asset' },
  { id: 'acc-jago', name: 'Bank Jago', kind: 'asset' },
  { id: 'acc-gopay', name: 'GoPay', kind: 'asset' },
  { id: 'acc-spaylater', name: 'SPayLater', kind: 'liability' },
];

const resExpense = parseTransactionLocally(
  'Makan siang padang 35rb pake gopay',
  mockCategories,
  mockAccounts
);
assert(resExpense.amount === 35000, 'amount 35000');
assert(resExpense.type === 'expense', 'type expense');
assert(resExpense.accountId === 'acc-gopay', 'accountId acc-gopay');
assert(resExpense.categoryId === 'cat-food', 'categoryId cat-food');
assert(resExpense.description.includes('Makan'), 'description contains Makan');

const resIncome = parseTransactionLocally(
  'Gaji bulanan masuk 8.5jt ke BCA',
  mockCategories,
  mockAccounts
);
assert(resIncome.amount === 8500000, 'amount 8500000');
assert(resIncome.type === 'income', 'type income');
assert(resIncome.accountId === 'acc-bca', 'accountId acc-bca');
assert(resIncome.categoryId === 'cat-salary', 'categoryId cat-salary');

const resTransfer = parseTransactionLocally(
  'Transfer 200rb dari BCA ke Jago',
  mockCategories,
  mockAccounts
);
assert(resTransfer.amount === 200000, 'amount 200000');
assert(resTransfer.type === 'transfer', 'type transfer');
assert(resTransfer.accountId === 'acc-bca', 'from account acc-bca');
assert(resTransfer.toAccountId === 'acc-jago', 'to account acc-jago');

const resLiability = parseTransactionLocally(
  'Beli kemeja 150.000 pake spaylater',
  mockCategories,
  mockAccounts
);
assert(resLiability.amount === 150000, 'amount 150000');
assert(resLiability.type === 'expense', 'type expense');
assert(resLiability.accountId === 'acc-spaylater', 'accountId spaylater');

console.log('textAssistantService Unit Tests passed');
