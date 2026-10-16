import assert from 'node:assert/strict';
import { transactionSchema, accountSchema, categorySchema } from './schemas';

// Account
assert.doesNotThrow(() => {
  accountSchema.parse({
    id: 'acc-1',
    name: 'Tunai',
    kind: 'asset',
    balance: 50000,
    createdAt: Date.now(),
  });
});

// Transfer to same account fails
assert.throws(() => {
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
assert.doesNotThrow(() => {
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
});

// Negative amount fails
assert.throws(() => {
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
});

console.log('Schemas assert checks pass');
