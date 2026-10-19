import { parseTransactionLocally } from '../../lib/nlp/textAssistantService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// 1. Text Assistant Tab Data Transformation Unit Tests
const categories = [
  { id: 'cat-food', name: 'Makanan & Minuman', type: 'expense' as const },
  { id: 'cat-transport', name: 'Transportasi', type: 'expense' as const },
  { id: 'cat-salary', name: 'Gaji', type: 'income' as const },
];

const accounts = [
  { id: 'acc-bca', name: 'BCA Utama', kind: 'asset' as const },
  { id: 'acc-gopay', name: 'GoPay', kind: 'asset' as const },
  { id: 'acc-spaylater', name: 'SPayLater', kind: 'liability' as const },
];

// Test quick suggestion 1: Makan siang
{
  const res = parseTransactionLocally('Makan siang padang 35rb pake Gopay', categories, accounts);
  assert(res.amount === 35000, 'Nominal parsed 35000');
  assert(res.type === 'expense', 'Type expense');
  assert(res.accountId === 'acc-gopay', 'Matched GoPay');
  assert(res.categoryId === 'cat-food', 'Matched Makanan');
}

// Test quick suggestion 2: Beli bensin
{
  const res = parseTransactionLocally('Beli bensin 50k Cash', categories, accounts);
  assert(res.amount === 50000, 'Nominal parsed 50000');
  assert(res.type === 'expense', 'Type expense');
  assert(res.categoryId === 'cat-transport', 'Matched Transportasi');
}

// Test quick suggestion 3: Kopi susu SPayLater
{
  const res = parseTransactionLocally('Kopi susu 25k SPayLater', categories, accounts);
  assert(res.amount === 25000, 'Nominal parsed 25000');
  assert(res.accountId === 'acc-spaylater', 'Matched SPayLater');
}

// Test quick suggestion 4: Gaji bulanan
{
  const res = parseTransactionLocally('Gaji bulanan masuk 8.5jt ke BCA', categories, accounts);
  assert(res.amount === 8500000, 'Nominal parsed 8500000');
  assert(res.type === 'income', 'Type income');
  assert(res.accountId === 'acc-bca', 'Matched BCA');
  assert(res.categoryId === 'cat-salary', 'Matched Gaji');
}

console.log('TextAssistantTab tests passed');
