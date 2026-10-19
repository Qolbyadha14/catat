import {
  collection,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  transactionSchema,
  type Transaction,
} from '../../lib/schemas';

export type CreateTransactionInput =
  | {
      type: 'income';
      amount: number;
      accountId: string;
      categoryId: string;
      date: number;
      note?: string;
    }
  | {
      type: 'expense';
      amount: number;
      accountId: string;
      categoryId: string;
      date: number;
      note?: string;
    }
  | {
      type: 'transfer';
      amount: number;
      fromAccountId: string;
      toAccountId: string;
      date: number;
      note?: string;
    };

export async function createTransaction(
  uid: string,
  input: CreateTransactionInput
): Promise<Transaction> {
  return runTransaction(db, async (txn) => {
    if (input.type === 'transfer') {
      const fromRef = doc(db, 'users', uid, 'accounts', input.fromAccountId);
      const toRef = doc(db, 'users', uid, 'accounts', input.toAccountId);
      const [fromSnap, toSnap] = await Promise.all([txn.get(fromRef), txn.get(toRef)]);

      if (!fromSnap.exists() || !toSnap.exists()) {
        throw new Error('Akun transfer tidak ditemukan');
      }

      const fromBal = (fromSnap.data()['balance'] as number) ?? 0;
      const toBal = (toSnap.data()['balance'] as number) ?? 0;

      txn.update(fromRef, { balance: fromBal - input.amount });
      txn.update(toRef, { balance: toBal + input.amount });
    } else {
      const accRef = doc(db, 'users', uid, 'accounts', input.accountId);
      const accSnap = await txn.get(accRef);

      if (!accSnap.exists()) {
        throw new Error('Akun tidak ditemukan');
      }

      const currentBal = (accSnap.data()['balance'] as number) ?? 0;
      const delta = input.type === 'income' ? input.amount : -input.amount;

      txn.update(accRef, { balance: currentBal + delta });
    }

    const txCol = collection(db, 'users', uid, 'transactions');
    const txRef = doc(txCol);
    const now = Date.now();

    const validated = transactionSchema.parse({
      ...input,
      id: txRef.id,
      createdAt: now,
      updatedAt: now,
    });

    txn.set(txRef, validated);
    return validated;
  });
}

export async function deleteTransaction(
  uid: string,
  txId: string
): Promise<void> {
  return runTransaction(db, async (txn) => {
    const txRef = doc(db, 'users', uid, 'transactions', txId);
    const txSnap = await txn.get(txRef);

    if (!txSnap.exists()) {
      throw new Error('Transaksi tidak ditemukan');
    }

    const tx = transactionSchema.parse(txSnap.data());

    if (tx.type === 'transfer') {
      const fromRef = doc(db, 'users', uid, 'accounts', tx.fromAccountId);
      const toRef = doc(db, 'users', uid, 'accounts', tx.toAccountId);
      const [fromSnap, toSnap] = await Promise.all([txn.get(fromRef), txn.get(toRef)]);

      if (fromSnap.exists() && toSnap.exists()) {
        const fromBal = (fromSnap.data()['balance'] as number) ?? 0;
        const toBal = (toSnap.data()['balance'] as number) ?? 0;
        txn.update(fromRef, { balance: fromBal + tx.amount });
        txn.update(toRef, { balance: toBal - tx.amount });
      }
    } else {
      const accRef = doc(db, 'users', uid, 'accounts', tx.accountId);
      const accSnap = await txn.get(accRef);

      if (accSnap.exists()) {
        const currentBal = (accSnap.data()['balance'] as number) ?? 0;
        const delta = tx.type === 'income' ? -tx.amount : tx.amount;
        txn.update(accRef, { balance: currentBal + delta });
      }
    }

    txn.delete(txRef);
  });
}

export async function updateTransaction(
  uid: string,
  txId: string,
  input: CreateTransactionInput
): Promise<Transaction> {
  return runTransaction(db, async (txn) => {
    const txRef = doc(db, 'users', uid, 'transactions', txId);
    const txSnap = await txn.get(txRef);

    if (!txSnap.exists()) {
      throw new Error('Transaksi tidak ditemukan');
    }

    const oldTx = transactionSchema.parse(txSnap.data());

    // Balance deltas map: accountId -> delta (positive adds to balance, negative deducts)
    const deltas = new Map<string, number>();
    const addDelta = (accId: string, delta: number) => {
      deltas.set(accId, (deltas.get(accId) ?? 0) + delta);
    };

    // 1. Revert old transaction effects
    if (oldTx.type === 'transfer') {
      addDelta(oldTx.fromAccountId, oldTx.amount);
      addDelta(oldTx.toAccountId, -oldTx.amount);
    } else {
      const revertDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
      addDelta(oldTx.accountId, revertDelta);
    }

    // 2. Apply new transaction effects
    if (input.type === 'transfer') {
      addDelta(input.fromAccountId, -input.amount);
      addDelta(input.toAccountId, input.amount);
    } else {
      const applyDelta = input.type === 'income' ? input.amount : -input.amount;
      addDelta(input.accountId, applyDelta);
    }

    // 3. Read all affected accounts (reads MUST precede writes in Firestore transaction)
    const affectedAccountIds = Array.from(deltas.keys());
    const accountRefs = affectedAccountIds.map((id) => doc(db, 'users', uid, 'accounts', id));
    const accountSnaps = await Promise.all(accountRefs.map((ref) => txn.get(ref)));

    accountSnaps.forEach((snap, idx) => {
      const ref = accountRefs[idx];
      const accId = affectedAccountIds[idx];
      if (!snap.exists() || !ref || !accId) {
        throw new Error('Akun transaksi tidak ditemukan');
      }
      const currentBal = (snap.data()['balance'] as number) ?? 0;
      const delta = deltas.get(accId) ?? 0;
      txn.update(ref, { balance: currentBal + delta });
    });

    const now = Date.now();
    const validated = transactionSchema.parse({
      ...input,
      id: txId,
      createdAt: oldTx.createdAt,
      updatedAt: now,
    });

    txn.set(txRef, validated);
    return validated;
  });
}

/**
 * Calculates net balance deltas grouped by accountId for a batch of transactions.
 */
export function calculateBatchBalanceDeltas(
  items: CreateTransactionInput[]
): Record<string, number> {
  const deltas: Record<string, number> = {};

  for (const item of items) {
    if (item.type === 'transfer') {
      deltas[item.fromAccountId] = (deltas[item.fromAccountId] ?? 0) - item.amount;
      deltas[item.toAccountId] = (deltas[item.toAccountId] ?? 0) + item.amount;
    } else if (item.type === 'income') {
      deltas[item.accountId] = (deltas[item.accountId] ?? 0) + item.amount;
    } else if (item.type === 'expense') {
      deltas[item.accountId] = (deltas[item.accountId] ?? 0) - item.amount;
    }
  }

  return deltas;
}

/**
 * Atomically creates multiple transactions and updates all involved account balances.
 */
export async function createBatchTransactions(
  uid: string,
  items: CreateTransactionInput[]
): Promise<Transaction[]> {
  if (items.length === 0) return [];

  return runTransaction(db, async (txn) => {
    // 1. Calculate net balance deltas across all accounts
    const deltas = calculateBatchBalanceDeltas(items);
    const accountIds = Object.keys(deltas);

    // 2. Read all involved accounts (all reads MUST precede writes in Firestore)
    const accountRefs = accountIds.map((accId) => doc(db, 'users', uid, 'accounts', accId));
    const accountSnaps = await Promise.all(accountRefs.map((ref) => txn.get(ref)));

    // 3. Update account balances
    for (let i = 0; i < accountIds.length; i++) {
      const snap = accountSnaps[i];
      const accId = accountIds[i]!;
      const ref = accountRefs[i]!;
      if (!snap || !snap.exists()) {
        throw new Error(`Akun ${accId} tidak ditemukan`);
      }
      const currentBal = (snap.data()['balance'] as number) ?? 0;
      const delta = deltas[accId] ?? 0;
      txn.update(ref, { balance: currentBal + delta });
    }

    // 4. Create all transaction records
    const now = Date.now();
    const created: Transaction[] = [];

    for (const item of items) {
      const txRef = doc(collection(db, 'users', uid, 'transactions'));
      const validated = transactionSchema.parse({
        ...item,
        id: txRef.id,
        createdAt: now,
        updatedAt: now,
      });
      txn.set(txRef, validated);
      created.push(validated);
    }

    return created;
  });
}
