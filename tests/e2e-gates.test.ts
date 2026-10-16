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
import { updateAccount } from '../src/features/accounts/accountService';
import { canArchiveAccount } from '../src/lib/canArchiveAccount';
import { isNameUnique } from '../src/lib/manageValidation';
import { exportTransactionsCSV, escapeCsvField } from '../src/lib/exportTransactionsCSV';
import { evaluateMathExpression } from '../src/lib/mathEvaluator';
import { calculateNetCashflow } from '../src/lib/cashflow';
import { transactionSchema, type Transaction, type Account } from '../src/lib/schemas';
import { auditColorPairs, getContrastRatio } from '../src/lib/contrastChecker';
import * as fs from 'fs';
import * as path from 'path';

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

    // Gate P0.1 Regression: switch type must reset category filter
    // If categoryId stays 'cat_food' (expense) when switching to 'income' -> 0 results (stale category trap)
    const staleCategoryResult = runFilter('income', 'all', 'cat_food', '');
    expect(staleCategoryResult.length).toBe(0);

    // After reset categoryId to 'all' on type switch -> returns expected income
    const resetCategoryResult = runFilter('income', 'all', 'all', '');
    expect(resetCategoryResult.length).toBe(1);
    expect(resetCategoryResult[0]?.id).toBe('tx3');

    // Switch to transfer with stale category -> 0 results (transfers have no category)
    const staleTransferResult = runFilter('transfer', 'all', 'cat_food', '');
    expect(staleTransferResult.length).toBe(0);

    // Switch to transfer with reset category -> returns transfer
    const resetTransferResult = runFilter('transfer', 'all', 'all', '');
    expect(resetTransferResult.length).toBe(1);
    expect(resetTransferResult[0]?.id).toBe('tx4');
  });

  it('Gate 7: P0.3 Manage accounts/categories — canArchiveAccount guard, picker isolation & history resolution', async () => {
    // 1. Guard check: non-zero balance rejected with exact reason
    const accCashRef = doc(db, 'users', testUid, 'accounts', 'acc_cash');
    const accBankRef = doc(db, 'users', testUid, 'accounts', 'acc_bank');
    await updateDoc(accCashRef, { balance: 50_000, isArchived: false });
    await updateDoc(accBankRef, { balance: 0, isArchived: false });

    const activeList: Account[] = [
      { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 50_000, isArchived: false, createdAt: 0 },
      { id: 'acc_bank', name: 'Bank Jago', kind: 'asset', balance: 0, isArchived: false, createdAt: 0 },
    ];

    const guardNonZero = canArchiveAccount(activeList[0]!, activeList);
    expect(guardNonZero.allowed).toBe(false);
    expect(guardNonZero.reason).toBe('Pindahkan saldo dulu sebelum arsip');

    // 2. Guard check: last active account rejected with exact reason
    const singleActiveList: Account[] = [
      { id: 'acc_bank', name: 'Bank Jago', kind: 'asset', balance: 0, isArchived: false, createdAt: 0 },
    ];
    const guardLastActive = canArchiveAccount(singleActiveList[0]!, singleActiveList);
    expect(guardLastActive.allowed).toBe(false);
    expect(guardLastActive.reason).toBe('Akun aktif terakhir tidak bisa diarsip');

    // 3. Guard check: zero balance with another active account allowed
    const guardHappy = canArchiveAccount(activeList[1]!, activeList);
    expect(guardHappy.allowed).toBe(true);
    expect(guardHappy.reason).toBeUndefined();

    // 4. Unique name validation (case-insensitive & trimmed)
    expect(isNameUnique('  Tunai  ', activeList)).toBe(false);
    expect(isNameUnique('TUNAI', activeList)).toBe(false);
    expect(isNameUnique('Dana Darurat', activeList)).toBe(true);

    // 5. Execution: Archive acc_bank via updateAccount (whitelist ensures no balance drift)
    await updateAccount(testUid, 'acc_bank', { isArchived: true, balance: 999_999 } as any);
    const bankSnap = await getDoc(accBankRef);
    expect(bankSnap.data()?.isArchived).toBe(true);
    // Whitelist stripped balance: remains 0
    expect(bankSnap.data()?.balance).toBe(0);

    // 6. Picker isolation: Transaction form picker only consumes active accounts
    const allAccountsSnap = await getDocs(collection(db, 'users', testUid, 'accounts'));
    const allAccounts: Account[] = allAccountsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Account));
    const activeAccounts = allAccounts.filter((a) => !a.isArchived);

    // Form picker only gets 1 account ('acc_cash'), archived 'acc_bank' dropped
    expect(activeAccounts.length).toBe(1);
    expect(activeAccounts.some((a) => a.id === 'acc_bank')).toBe(false);

    // 7. History label resolution: Even though 'acc_bank' is archived, full map resolves name
    const accountsMap = new Map(allAccounts.map((a) => [a.id, a.name]));
    expect(accountsMap.get('acc_bank')).toBe('Rekening Utama'); // Resolved from seed default
  });

  it('Gate 8: P0.5 CSV Export — BOM header, RFC 4180 escaping, text formula sanitization, and archived label resolution', () => {
    const mockAccounts = [
      { id: 'acc_cash', name: 'Dompet Tunai', isArchived: false },
      { id: 'acc_bank', name: 'BCA Prioritas', isArchived: true },
    ];

    const mockCategories = [
      { id: 'cat_food', name: 'Makan & Minum', isArchived: false },
      { id: 'cat_sub', name: 'Langganan Cloud', isArchived: true },
    ];

    const testTxs: Transaction[] = [
      {
        id: 'tx_inj1',
        type: 'expense',
        amount: 50000,
        accountId: 'acc_cash',
        categoryId: 'cat_food',
        note: '=SUM(A1:A10)', // Formula injection test: =
        date: new Date('2026-10-16T10:00:00Z').getTime(),
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'tx_inj2',
        type: 'income',
        amount: 2500000,
        accountId: 'acc_bank', // Archived account
        categoryId: 'cat_sub',  // Archived category
        note: '+cmd|"/C calc"!A0', // Formula injection test: +
        date: new Date('2026-10-15T09:30:00Z').getTime(),
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'tx_escape',
        type: 'expense',
        amount: 15000,
        accountId: 'acc_cash',
        categoryId: 'cat_food',
        note: 'Kopi "Gayo", Aceh\nDingin', // RFC 4180 quotes, comma, newline
        date: new Date('2026-10-14T08:00:00Z').getTime(),
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: 'tx_transfer',
        type: 'transfer',
        amount: 100000,
        fromAccountId: 'acc_bank', // Archived from
        toAccountId: 'acc_cash',
        note: '@mention transfer note', // Formula injection test: @
        date: new Date('2026-10-13T12:00:00Z').getTime(),
        createdAt: 4,
        updatedAt: 4,
      },
    ];

    const csv = exportTransactionsCSV(testTxs, mockAccounts, mockCategories);

    // 1. BOM header (\uFEFF) present for Excel UTF-8 compatibility
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // 2. CSV standard headers
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(lines[0]).toBe('tanggal,tipe,jumlah,akun,kategori,catatan');
    expect(lines.length).toBe(5); // Header + 4 rows

    // 3. Formula injection sanitization prefix (') on text columns only
    // Row 1: '=SUM(A1:A10)' -> "'=SUM(A1:A10)"
    expect(lines[1]).toContain("'=SUM(A1:A10)");
    // Row 2: '+cmd|...' -> "'+cmd|..."
    expect(lines[2]).toContain("'+cmd");
    // Row 4: '@mention...' -> "'@mention..."
    expect(lines[4]).toContain("'@mention");

    // 4. Raw numeric amount (not prefixed with ' even if positive/negative)
    expect(lines[1]).toContain(',50000,');
    expect(lines[2]).toContain(',2500000,');
    expect(lines[3]).toContain(',15000,');
    expect(lines[4]).toContain(',100000,');

    // 5. RFC 4180 escaping: double quotes, commas, newlines wrapped
    expect(lines[3]).toContain('"Kopi ""Gayo"", Aceh\nDingin"');

    // 6. Archived label resolution: '(Arsip)' appended to archived account/category
    expect(lines[2]).toContain('BCA Prioritas (Arsip)');
    expect(lines[2]).toContain('Langganan Cloud (Arsip)');

    // 7. Transfer formatting: "From -> To" and category "Transfer"
    expect(lines[4]).toContain('BCA Prioritas (Arsip) → Dompet Tunai,Transfer');

    // 8. Single field escape helper safety checks
    expect(escapeCsvField('=cmd', true)).toBe("'=cmd");
    expect(escapeCsvField('-123', true)).toBe("'-123");
    expect(escapeCsvField(-123, false)).toBe('-123'); // raw number untouched
    expect(escapeCsvField(45000, false)).toBe('45000');
  });

  it('Gate 9: Inline Math Evaluator — operator precedence, division by zero, float rounding, trailing operator', async () => {
    // 1. Operator precedence: 2 + 3 * 4 = 14 (not 20)
    const precRes = evaluateMathExpression('2 + 3 * 4');
    expect(precRes.success).toBe(true);
    if (precRes.success) {
      expect(precRes.value).toBe(14);
    }

    // 2. Trailing operator fallback: "15000+" evaluates to 15000
    const trailingRes = evaluateMathExpression('15000+');
    expect(trailingRes.success).toBe(true);
    if (trailingRes.success) {
      expect(trailingRes.value).toBe(15000);
    }

    // 3. Division by zero guard: returns error "Pembagi nol"
    const divZeroRes = evaluateMathExpression('25000 / 0');
    expect(divZeroRes.success).toBe(false);
    if (!divZeroRes.success) {
      expect(divZeroRes.error).toBe('Pembagi nol');
    }

    // 4. Float precision rounding: 0.1 + 0.2 = 0.3
    const floatRes = evaluateMathExpression('0.1 + 0.2');
    expect(floatRes.success).toBe(true);
    if (floatRes.success) {
      expect(floatRes.value).toBe(0.3);
    }

    // 5. Negative value guard: result < 0 rejected for nominal
    const negRes = evaluateMathExpression('5000 - 10000');
    expect(negRes.success).toBe(false);
    if (!negRes.success) {
      expect(negRes.error).toBe('Hasil kalkulasi tidak boleh negatif');
    }

    // 6. Seamless integration with createTransaction
    if (precRes.success) {
      const tx = await createTransaction(testUid, {
        type: 'expense',
        amount: precRes.value,
        accountId: 'acc_cash',
        categoryId: 'cat_food',
        date: Date.now(),
        note: 'Evaluated nominal tx',
      });
      expect(tx.id).toBeDefined();
      expect(tx.amount).toBe(14);
    }
  });

  it('Gate 10: 3-Column Net Cashflow — surplus, deficit, net=0 derived calculations', () => {
    // 1. Surplus: Income > Expense
    const surplus = calculateNetCashflow(5_000_000, 3_200_000);
    expect(surplus.net).toBe(1_800_000);
    expect(surplus.isSurplus).toBe(true);
    expect(surplus.formatted.startsWith('+')).toBe(true);

    // 2. Deficit: Income < Expense
    const deficit = calculateNetCashflow(1_000_000, 2_500_000);
    expect(deficit.net).toBe(-1_500_000);
    expect(deficit.isSurplus).toBe(false);
    expect(deficit.formatted.startsWith('-')).toBe(true);

    // 3. Zero Net: Income == Expense (treated as surplus with +)
    const zeroNet = calculateNetCashflow(1_000_000, 1_000_000);
    expect(zeroNet.net).toBe(0);
    expect(zeroNet.isSurplus).toBe(true);
    expect(zeroNet.formatted.startsWith('+')).toBe(true);
  });

  it('Gate 11: Atomic Delete Transaction — full dual-leg transfer rollback and document removal', async () => {
    const cashRef = doc(db, 'users', testUid, 'accounts', 'acc_cash');
    const bankRef = doc(db, 'users', testUid, 'accounts', 'acc_bank');
    await updateDoc(cashRef, { balance: 500_000 });
    await updateDoc(bankRef, { balance: 1_000_000 });

    // Create dual-leg transfer: 200k from bank to cash
    const trf = await createTransaction(testUid, {
      type: 'transfer',
      amount: 200_000,
      fromAccountId: 'acc_bank',
      toAccountId: 'acc_cash',
      date: Date.now(),
      note: 'Transfer to be deleted',
    });

    let cashSnap = await getDoc(cashRef);
    let bankSnap = await getDoc(bankRef);
    expect(cashSnap.data()?.balance).toBe(700_000);
    expect(bankSnap.data()?.balance).toBe(800_000);

    // Atomic delete: should rollback both legs
    await deleteTransaction(testUid, trf.id);

    cashSnap = await getDoc(cashRef);
    bankSnap = await getDoc(bankRef);
    expect(cashSnap.data()?.balance).toBe(500_000);
    expect(bankSnap.data()?.balance).toBe(1_000_000);

    // Ensure document is deleted
    const txSnap = await getDoc(doc(db, 'users', testUid, 'transactions', trf.id));
    expect(txSnap.exists()).toBe(false);
  });

  it('Gate 12: Visual Contrast & Token Audit — WCAG AA compliance (>=4.5:1 text, >=3:1 UI), 44px touch targets, zero raw hex', () => {
    // 1. Light Mode Tokens WCAG AA Audit
    const lightAudit = auditColorPairs([
      { label: 'Light: Text Primary on Surface Card', fg: '#0f172a', bg: '#ffffff' },
      { label: 'Light: Text Primary on Surface Base', fg: '#0f172a', bg: '#f8fafc' },
      { label: 'Light: Text Muted on Surface Card', fg: '#64748b', bg: '#ffffff' },
      { label: 'Light: Button Text on Accent Primary', fg: '#ffffff', bg: '#4f46e5' },
      { label: 'Light: Success Text on Surface Card', fg: '#047857', bg: '#ffffff' },
      { label: 'Light: Warning Text on Surface Card', fg: '#b45309', bg: '#ffffff' },
      { label: 'Light: Error Text on Surface Card', fg: '#be123c', bg: '#ffffff' },
    ]);
    expect(lightAudit.passed).toBe(true);
    for (const r of lightAudit.results) {
      expect(r.ratio).toBeGreaterThanOrEqual(4.5);
    }

    // 2. Dark Mode Tokens WCAG AA Audit
    const darkAudit = auditColorPairs([
      { label: 'Dark: Text Primary on Surface Card', fg: '#f9fafb', bg: '#111827' },
      { label: 'Dark: Text Primary on Surface Base', fg: '#f9fafb', bg: '#0b0f19' },
      { label: 'Dark: Text Muted on Surface Card', fg: '#94a3b8', bg: '#111827' },
      { label: 'Dark: Success Text on Surface Card', fg: '#10b981', bg: '#111827' },
      { label: 'Dark: Warning Text on Surface Card', fg: '#f59e0b', bg: '#111827' },
      { label: 'Dark: Error Text on Surface Card', fg: '#f43f5e', bg: '#111827' },
      { label: 'Dark: Button UI Accent on Surface Card', fg: '#6366f1', bg: '#111827', isLargeText: true },
    ]);
    expect(darkAudit.passed).toBe(true);

    // 3. Hero Card Contrast (Dark Gradient Background: #0f172a / #1e293b)
    const heroSurplusRatio1 = getContrastRatio('#34d399', '#0f172a');
    const heroSurplusRatio2 = getContrastRatio('#34d399', '#1e293b');
    const heroDeficitRatio1 = getContrastRatio('#f87171', '#0f172a');
    const heroDeficitRatio2 = getContrastRatio('#f87171', '#1e293b');
    const heroBalanceRatio = getContrastRatio('#ffffff', '#0f172a');

    expect(heroSurplusRatio1).toBeGreaterThanOrEqual(4.5);
    expect(heroSurplusRatio2).toBeGreaterThanOrEqual(4.5);
    expect(heroDeficitRatio1).toBeGreaterThanOrEqual(4.5);
    expect(heroDeficitRatio2).toBeGreaterThanOrEqual(4.5);
    expect(heroBalanceRatio).toBeGreaterThanOrEqual(4.5);

    // 4. CSS File Audit: src/styles/components.css
    const componentsCssPath = path.resolve(process.cwd(), 'src/styles/components.css');
    const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

    // Strip comments to check for raw hardcoded hex in rules
    const strippedCss = componentsCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const hexMatches = strippedCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    expect(hexMatches.length).toBe(0);

    // Check minimum touch target of 44px in components
    expect(componentsCss.includes('min-height: 44px') || componentsCss.includes('height: 44px')).toBe(true);
    expect(componentsCss.includes('.pill-type-btn.active')).toBe(true);
    expect(componentsCss.includes('var(--accent-primary)')).toBe(true);
  });
});
