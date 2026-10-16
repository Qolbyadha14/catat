import type { Transaction } from '../../lib/schemas';
import type { CreateTransactionInput } from './transactionService';

function assertStrictEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, but got ${String(actual)}`);
  }
}

function calculateDeltas(oldTx: Transaction, input: CreateTransactionInput): Map<string, number> {
  const deltas = new Map<string, number>();
  const addDelta = (accId: string, delta: number) => {
    deltas.set(accId, (deltas.get(accId) ?? 0) + delta);
  };

  // 1. Revert old
  if (oldTx.type === 'transfer') {
    addDelta(oldTx.fromAccountId, oldTx.amount);
    addDelta(oldTx.toAccountId, -oldTx.amount);
  } else {
    const revertDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
    addDelta(oldTx.accountId, revertDelta);
  }

  // 2. Apply new
  if (input.type === 'transfer') {
    addDelta(input.fromAccountId, -input.amount);
    addDelta(input.toAccountId, input.amount);
  } else {
    const applyDelta = input.type === 'income' ? input.amount : -input.amount;
    addDelta(input.accountId, applyDelta);
  }

  return deltas;
}

// Case 1: Expense increased from 50k to 70k on same account
{
  const oldTx: Transaction = {
    id: 'tx-1',
    type: 'expense',
    amount: 50000,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    note: '',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const input: CreateTransactionInput = {
    type: 'expense',
    amount: 70000,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    date: Date.now(),
  };
  const d = calculateDeltas(oldTx, input);
  assertStrictEqual(d.get('acc-1'), -20000);
}

// Case 2: Switched from expense 50k to income 50k
{
  const oldTx: Transaction = {
    id: 'tx-2',
    type: 'expense',
    amount: 50000,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    note: '',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const input: CreateTransactionInput = {
    type: 'income',
    amount: 50000,
    accountId: 'acc-1',
    categoryId: 'cat-2',
    date: Date.now(),
  };
  const d = calculateDeltas(oldTx, input);
  assertStrictEqual(d.get('acc-1'), 100000);
}

// Case 3: Transfer amount reduced from 50k to 20k (acc-1 -> acc-2)
{
  const oldTx: Transaction = {
    id: 'tx-3',
    type: 'transfer',
    amount: 50000,
    fromAccountId: 'acc-1',
    toAccountId: 'acc-2',
    note: '',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const input: CreateTransactionInput = {
    type: 'transfer',
    amount: 20000,
    fromAccountId: 'acc-1',
    toAccountId: 'acc-2',
    date: Date.now(),
  };
  const d = calculateDeltas(oldTx, input);
  assertStrictEqual(d.get('acc-1'), 30000);
  assertStrictEqual(d.get('acc-2'), -30000);
}

console.log('Transaction delta math asserts pass');
