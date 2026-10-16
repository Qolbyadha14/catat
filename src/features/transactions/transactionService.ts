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
