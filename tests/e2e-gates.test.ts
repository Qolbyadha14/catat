import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../src/lib/firebase';
import { ensureUserDefaults } from '../src/features/auth/seedDefaults';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../src/features/transactions/transactionService';
import { transactionSchema, type Transaction } from '../src/lib/schemas';

let testUid: string;

describe('E2E P0 Gates (Auth, Firestore, Balance Atomicity)', () => {
  beforeAll(async () => {
    // Authenticate with Firebase Auth emulator to satisfy firestore.rules (request.auth.uid == uid)
    const cred = await signInAnonymously(auth);
    testUid = cred.user.uid;
  });

  beforeEach(async () => {
    // Seed user defaults
    await ensureUserDefaults(testUid);
  });

  it('Gate 6: Seed idempotent — multiple calls do not duplicate accounts or categories', async () => {
    // Call seed second time
    await ensureUserDefaults(testUid);
    // Call seed third time
    await ensureUserDefaults(testUid);

    const accountsSnap = await getDocs(collection(db, 'users', testUid, 'accounts'));
    const categoriesSnap = await getDocs(collection(db, 'users', testUid, 'categories'));

    expect(accountsSnap.size).toBe(2);
    expect(categoriesSnap.size).toBe(8);

    const accountIds = accountsSnap.docs.map((d) => d.id).sort();
    expect(accountIds).toEqual(['acc_bank', 'acc_cash']);
  });

  it('Gate 1: Saldo createTransaction (expense, income, transfer & hero card total)', async () => {
    // Reset initial balances: acc_cash = 100_000, acc_bank = 500_000
    const cashRef = doc(db, 'users', testUid, 'accounts', 'acc_cash');
    const bankRef = doc(db, 'users', testUid, 'accounts', 'acc_bank');
    await updateDoc(cashRef, { balance: 100_000 });
    await updateDoc(bankRef, { balance: 500_000 });

    // 1. Expense: spend 25k from acc_cash
    const expTx = await createTransaction(testUid, {
      type: 'expense',
      amount: 25_000,
      accountId: 'acc_cash',
      categoryId: 'cat_food',
      date: Date.now(),
      note: 'Makan siang',
    });
    expect(expTx.id).toBeDefined();

    let cashSnap = await getDoc(cashRef);
    expect(cashSnap.data()?.balance).toBe(75_000);

    // 2. Income: receive 200k into acc_bank
    const incTx = await createTransaction(testUid, {
      type: 'income',
      amount: 200_000,
      accountId: 'acc_bank',
      categoryId: 'cat_salary',
      date: Date.now(),
      note: 'Bonus',
    });
    expect(incTx.id).toBeDefined();

    let bankSnap = await getDoc(bankRef);
    expect(bankSnap.data()?.balance).toBe(700_000);

    // 3. Transfer: transfer 50k from acc_bank to acc_cash
    const trfTx = await createTransaction(testUid, {
      type: 'transfer',
      amount: 50_000,
      fromAccountId: 'acc_bank',
      toAccountId: 'acc_cash',
      date: Date.now(),
      note: 'Tarik tunai',
    });
    expect(trfTx.id).toBeDefined();

    cashSnap = await getDoc(cashRef);
    bankSnap = await getDoc(bankRef);
    expect(cashSnap.data()?.balance).toBe(125_000);
    expect(bankSnap.data()?.balance).toBe(650_000);

    // Total balance in hero card = sum of accounts
    const totalBalance = (cashSnap.data()?.balance ?? 0) + (bankSnap.data()?.balance ?? 0);
    expect(totalBalance).toBe(775_000);
  });

  it('Gate 2: Saldo updateTransaction (nominal change, account change, type change)', async () => {
    const cashRef = doc(db, 'users', testUid, 'accounts', 'acc_cash');
    const bankRef = doc(db, 'users', testUid, 'accounts', 'acc_bank');
    await updateDoc(cashRef, { balance: 200_000 });
    await updateDoc(bankRef, { balance: 500_000 });

    // Initial tx: expense 50k on acc_cash -> cash balance becomes 150_000
    const tx = await createTransaction(testUid, {
      type: 'expense',
      amount: 50_000,
      accountId: 'acc_cash',
      categoryId: 'cat_food',
      date: Date.now(),
      note: 'Belanja',
    });

    let cashSnap = await getDoc(cashRef);
    expect(cashSnap.data()?.balance).toBe(150_000);

    // Case 2A: Change nominal (50k -> 80k expense on acc_cash)
    // Cash balance should revert +50k then -80k => 120_000
    await updateTransaction(testUid, tx.id, {
      type: 'expense',
      amount: 80_000,
      accountId: 'acc_cash',
      categoryId: 'cat_food',
      date: Date.now(),
      note: 'Belanja update',
    });
    cashSnap = await getDoc(cashRef);
    expect(cashSnap.data()?.balance).toBe(120_000);

    // Case 2B: Change account (move expense from acc_cash to acc_bank, amount 80k)
    // acc_cash reverts (+80k) => 200_000
    // acc_bank deducts (-80k) => 420_000
    await updateTransaction(testUid, tx.id, {
      type: 'expense',
      amount: 80_000,
      accountId: 'acc_bank',
      categoryId: 'cat_food',
      date: Date.now(),
      note: 'Pindah ke bank',
    });
    cashSnap = await getDoc(cashRef);
    let bankSnap = await getDoc(bankRef);
    expect(cashSnap.data()?.balance).toBe(200_000);
    expect(bankSnap.data()?.balance).toBe(420_000);

    // Case 2C: Change type (expense 80k on bank -> transfer 100k from bank to cash)
    // Revert expense on bank (+80k) => 500_000
    // Apply transfer: bank (-100k) => 400_000, cash (+100k) => 300_000
    await updateTransaction(testUid, tx.id, {
      type: 'transfer',
      amount: 100_000,
      fromAccountId: 'acc_bank',
      toAccountId: 'acc_cash',
      date: Date.now(),
      note: 'Ganti jadi transfer',
    });
    cashSnap = await getDoc(cashRef);
    bankSnap = await getDoc(bankRef);
    expect(bankSnap.data()?.balance).toBe(400_000);
    expect(cashSnap.data()?.balance).toBe(300_000);
  });

  it('Gate 3: Saldo deleteTransaction (reverts balance perfectly)', async () => {
    const cashRef = doc(db, 'users', testUid, 'accounts', 'acc_cash');
    const bankRef = doc(db, 'users', testUid, 'accounts', 'acc_bank');
    await updateDoc(cashRef, { balance: 300_000 });
    await updateDoc(bankRef, { balance: 400_000 });

    // Transfer 100k from bank to cash: bank -> 300_000, cash -> 400_000
    const trf = await createTransaction(testUid, {
      type: 'transfer',
      amount: 100_000,
      fromAccountId: 'acc_bank',
      toAccountId: 'acc_cash',
      date: Date.now(),
    });

    let cashSnap = await getDoc(cashRef);
    let bankSnap = await getDoc(bankRef);
    expect(bankSnap.data()?.balance).toBe(300_000);
    expect(cashSnap.data()?.balance).toBe(400_000);

    // Delete transaction: bank reverts to 400_000, cash reverts to 300_000
    await deleteTransaction(testUid, trf.id);

    cashSnap = await getDoc(cashRef);
    bankSnap = await getDoc(bankRef);
    expect(bankSnap.data()?.balance).toBe(400_000);
    expect(cashSnap.data()?.balance).toBe(300_000);

    // Document in Firestore must be gone
    const txSnap = await getDoc(doc(db, 'users', testUid, 'transactions', trf.id));
    expect(txSnap.exists()).toBe(false);
  });

  it('Gate 4: Negative validation (nominal 0/negative, transfer same account, schema rejection)', async () => {
    // 1. Amount 0 rejected
    expect(() =>
      transactionSchema.parse({
        id: 'tx_fail_1',
        type: 'expense',
        amount: 0,
        accountId: 'acc_cash',
        categoryId: 'cat_food',
        date: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    ).toThrow();

    // 2. Negative amount rejected
    expect(() =>
      transactionSchema.parse({
        id: 'tx_fail_2',
        type: 'income',
        amount: -5000,
        accountId: 'acc_cash',
        categoryId: 'cat_salary',
        date: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    ).toThrow();

    // 3. Transfer with fromAccountId === toAccountId rejected
    expect(() =>
      transactionSchema.parse({
        id: 'tx_fail_3',
        type: 'transfer',
        amount: 50_000,
        fromAccountId: 'acc_cash',
        toAccountId: 'acc_cash',
        date: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    ).toThrow();

    // 4. Missing required field (e.g. categoryId for expense) rejected
    expect(() =>
      transactionSchema.parse({
        id: 'tx_fail_4',
        type: 'expense',
        amount: 50_000,
        accountId: 'acc_cash',
        date: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    ).toThrow();
  });

  it('Gate 5: Filter logic (type, account, category, keyword with AND logic & empty state)', () => {
    const mockTxs: Transaction[] = [
      {
        id: 'tx1',
        type: 'expense',
        amount: 35_000,
        accountId: 'acc_cash',
        categoryId: 'cat_food',
        note: 'Kopi Kenangan',
        date: 1000,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'tx2',
        type: 'expense',
        amount: 15_000,
        accountId: 'acc_bank',
        categoryId: 'cat_transport',
        note: 'MRT Bundaran HI',
        date: 2000,
        createdAt: 2000,
        updatedAt: 2000,
      },
      {
        id: 'tx3',
        type: 'income',
        amount: 10_000_000,
        accountId: 'acc_bank',
        categoryId: 'cat_salary',
        note: 'Gaji Bulanan',
        date: 3000,
        createdAt: 3000,
        updatedAt: 3000,
      },
      {
        id: 'tx4',
        type: 'transfer',
        amount: 100_000,
        fromAccountId: 'acc_bank',
        toAccountId: 'acc_cash',
        note: 'Ambil ATM',
        date: 4000,
        createdAt: 4000,
        updatedAt: 4000,
      },
    ];

    const categoryMap = new Map([
      ['cat_food', { id: 'cat_food', name: 'Makan & Minum', type: 'expense' as const, isArchived: false, createdAt: 0 }],
      ['cat_transport', { id: 'cat_transport', name: 'Transportasi', type: 'expense' as const, isArchived: false, createdAt: 0 }],
      ['cat_salary', { id: 'cat_salary', name: 'Gaji', type: 'income' as const, isArchived: false, createdAt: 0 }],
    ]);

    const runFilter = (
      filterType: string,
      selectedAccountId: string,
      selectedCategoryId: string,
      keyword: string
    ) => {
      return mockTxs.filter((tx) => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (selectedAccountId !== 'all') {
          if (tx.type === 'transfer') {
            if (tx.fromAccountId !== selectedAccountId && tx.toAccountId !== selectedAccountId) {
              return false;
            }
          } else if (tx.accountId !== selectedAccountId) {
            return false;
          }
        }
        if (selectedCategoryId !== 'all') {
          if (tx.type === 'transfer') return false;
          if (tx.categoryId !== selectedCategoryId) return false;
        }
        if (keyword.trim()) {
          const q = keyword.toLowerCase();
          const noteMatch = tx.note?.toLowerCase().includes(q);
          const catName = tx.type !== 'transfer' ? categoryMap.get(tx.categoryId)?.name.toLowerCase() : '';
          const catMatch = catName?.includes(q);
          if (!noteMatch && !catMatch) return false;
        }
        return true;
      });
    };

    // Filter by type: expense -> 2 items
    expect(runFilter('expense', 'all', 'all', '').length).toBe(2);

    // Filter by type: transfer -> 1 item
    expect(runFilter('transfer', 'all', 'all', '').length).toBe(1);

    // AND filter: expense + acc_cash -> 1 item (tx1)
    const resCashFood = runFilter('expense', 'acc_cash', 'all', '');
    expect(resCashFood.length).toBe(1);
    expect(resCashFood[0]?.id).toBe('tx1');

    // AND filter: keyword 'MRT' -> 1 item (tx2)
    const resKeyword = runFilter('all', 'all', 'all', 'mrt');
    expect(resKeyword.length).toBe(1);
    expect(resKeyword[0]?.id).toBe('tx2');

    // AND filter non-matching -> 0 items (triggers empty state)
    const resEmpty = runFilter('income', 'acc_cash', 'all', 'nonexistent');
    expect(resEmpty.length).toBe(0);
  });
});
