import { transactionSchema, accountSchema, categorySchema } from './schemas';

function throws(fn: () => void, match: RegExp) {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!match.test(msg)) throw new Error(`Expected error matching ${match}, got: ${msg}`);
  }
}

// Account
accountSchema.parse({
  id: 'acc-1',
  name: 'Tunai',
  kind: 'asset',
  balance: 50000,
  createdAt: Date.now(),
});

// Category
categorySchema.parse({
  id: 'cat-1',
  name: 'Makan',
  type: 'expense',
  createdAt: Date.now(),
});

// Transfer to same account fails
throws(() => {
  transactionSchema.parse({
    id: 'tx-1',
    type: 'transfer',
    amount: 10000,
    fromAccountId: 'acc-1',
    toAccountId: 'acc-1',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}, /Akun tujuan harus berbeda/);

// Transfer to different account passes
transactionSchema.parse({
  id: 'tx-2',
  type: 'transfer',
  amount: 10000,
  fromAccountId: 'acc-1',
  toAccountId: 'acc-2',
  date: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Negative amount fails
throws(() => {
  transactionSchema.parse({
    id: 'tx-3',
    type: 'expense',
    amount: -5000,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}, /Too small/i);

console.log('Schemas assert checks pass');
