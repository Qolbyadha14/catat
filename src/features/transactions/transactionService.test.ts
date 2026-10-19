import { calculateBatchBalanceDeltas } from './transactionService';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// 1. calculateBatchBalanceDeltas computes accurate net deltas
{
  const deltas = calculateBatchBalanceDeltas([
    { type: 'expense', amount: 50000, accountId: 'acc1', categoryId: 'cat1', date: Date.now() },
    { type: 'expense', amount: 30000, accountId: 'acc1', categoryId: 'cat1', date: Date.now() },
    { type: 'income', amount: 100000, accountId: 'acc2', categoryId: 'cat2', date: Date.now() },
    { type: 'transfer', amount: 20000, fromAccountId: 'acc1', toAccountId: 'acc2', date: Date.now() },
  ]);

  // acc1: -50000 - 30000 - 20000 = -100000
  assert(deltas['acc1'] === -100000, `acc1 delta must be -100000, got: ${deltas['acc1']}`);
  // acc2: +100000 + 20000 = 120000
  assert(deltas['acc2'] === 120000, `acc2 delta must be 120000, got: ${deltas['acc2']}`);
}

// 2. Empty batch returns empty object
{
  const emptyDeltas = calculateBatchBalanceDeltas([]);
  assert(Object.keys(emptyDeltas).length === 0, 'empty items return empty deltas');
}

console.log('transactionService batch delta tests pass');
