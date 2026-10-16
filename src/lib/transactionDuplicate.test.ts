import { prepareTransactionDuplicate } from './transactionDuplicate';
import type { Account, Category, Transaction } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const mockAccounts: Account[] = [
  { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 500000, isArchived: false, createdAt: 1000 },
  { id: 'acc_bank', name: 'Bank BCA', kind: 'asset', balance: 2000000, isArchived: false, createdAt: 1000 },
  { id: 'acc_old', name: 'Rekening Lama', kind: 'asset', balance: 0, isArchived: true, createdAt: 1000 },
];

const mockCategories: Category[] = [
  { id: 'cat_food', name: 'Makanan', type: 'expense', icon: '🍲', isArchived: false, createdAt: 1000 },
  { id: 'cat_transport', name: 'Transport', type: 'expense', icon: '🚗', isArchived: false, createdAt: 1000 },
  { id: 'cat_salary', name: 'Gaji', type: 'income', icon: '💰', isArchived: false, createdAt: 1000 },
  { id: 'cat_archived_expense', name: 'Hobi Lama', type: 'expense', icon: '🎮', isArchived: true, createdAt: 1000 },
];

// 1. Normal expense duplicate
{
  const originalTx: Transaction = {
    id: 'tx_original_1',
    type: 'expense',
    amount: 35000,
    accountId: 'acc_cash',
    categoryId: 'cat_food',
    date: new Date('2025-01-01').getTime(),
    note: 'Nasi padang',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const beforeSnap = JSON.stringify(originalTx);
  const dup = prepareTransactionDuplicate(originalTx, mockAccounts, mockCategories);

  // Original tx is not mutated
  assert(JSON.stringify(originalTx) === beforeSnap, 'Original tx must not be mutated');

  // Fields prefilled correctly
  assert(dup.type === 'expense', 'Type matches');
  assert(dup.amount === 35000, 'Amount matches');
  assert(dup.accountId === 'acc_cash', 'Account matches');
  assert(dup.categoryId === 'cat_food', 'Category matches');
  assert(dup.note === 'Nasi padang', 'Note matches');
  assert(dup.toAccountId === '', 'toAccountId is empty for expense');

  // Date is today, not old date
  const now = new Date();
  assert(dup.date.getFullYear() === now.getFullYear(), 'Date year is current');
  assert(dup.date.getMonth() === now.getMonth(), 'Date month is current');
  assert(dup.date.getDate() === now.getDate(), 'Date day is current');

  // ID is not present on duplicate form values (treated as new transaction)
  assert(!('id' in dup), 'Duplicate values must not contain id');
}

// 2. Archived account fallback to empty string
{
  const txWithArchivedAcc: Transaction = {
    id: 'tx_2',
    type: 'expense',
    amount: 75000,
    accountId: 'acc_old',
    categoryId: 'cat_food',
    date: Date.now(),
    note: 'Beli makan',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const dup = prepareTransactionDuplicate(txWithArchivedAcc, mockAccounts, mockCategories);
  assert(dup.accountId === '', 'Archived account must fallback to empty string');
  assert(dup.categoryId === 'cat_food', 'Active category is preserved');
}

// 3. Archived category fallback to empty string
{
  const txWithArchivedCat: Transaction = {
    id: 'tx_3',
    type: 'expense',
    amount: 120000,
    accountId: 'acc_bank',
    categoryId: 'cat_archived_expense',
    date: Date.now(),
    note: 'Beli game',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const dup = prepareTransactionDuplicate(txWithArchivedCat, mockAccounts, mockCategories);
  assert(dup.accountId === 'acc_bank', 'Active account is preserved');
  assert(dup.categoryId === '', 'Archived category must fallback to empty string');
}

// 4. Category type mismatch fallback to empty string
{
  const txTypeMismatch: Transaction = {
    id: 'tx_4',
    type: 'expense',
    amount: 50000,
    accountId: 'acc_cash',
    categoryId: 'cat_salary', // cat_salary is type 'income'
    date: Date.now(),
    note: '',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const dup = prepareTransactionDuplicate(txTypeMismatch, mockAccounts, mockCategories);
  assert(dup.categoryId === '', 'Category type mismatch must fallback to empty string');
}

// 5. Transfer duplicate with active source and target accounts
{
  const transferTx: Transaction = {
    id: 'tx_transfer_1',
    type: 'transfer',
    amount: 100000,
    fromAccountId: 'acc_bank',
    toAccountId: 'acc_cash',
    date: new Date('2025-05-10').getTime(),
    note: 'Tarik tunai ATM',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const dup = prepareTransactionDuplicate(transferTx, mockAccounts, mockCategories);
  assert(dup.type === 'transfer', 'Type is transfer');
  assert(dup.amount === 100000, 'Amount matches');
  assert(dup.accountId === 'acc_bank', 'Source account matches');
  assert(dup.toAccountId === 'acc_cash', 'Target account matches');
  assert(dup.categoryId === '', 'Transfer category is empty string');
  assert(dup.note === 'Tarik tunai ATM', 'Note matches');
}

// 6. Transfer dual-leg with archived source or destination
{
  const transferWithArchivedSource: Transaction = {
    id: 'tx_transfer_2',
    type: 'transfer',
    amount: 50000,
    fromAccountId: 'acc_old',
    toAccountId: 'acc_cash',
    date: Date.now(),
    note: '',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const dup1 = prepareTransactionDuplicate(transferWithArchivedSource, mockAccounts, mockCategories);
  assert(dup1.accountId === '', 'Archived source account must fallback to empty string');
  assert(dup1.toAccountId === 'acc_cash', 'Active target account is preserved');

  const transferWithArchivedTarget: Transaction = {
    id: 'tx_transfer_3',
    type: 'transfer',
    amount: 50000,
    fromAccountId: 'acc_bank',
    toAccountId: 'acc_old',
    date: Date.now(),
    note: '',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const dup2 = prepareTransactionDuplicate(transferWithArchivedTarget, mockAccounts, mockCategories);
  assert(dup2.accountId === 'acc_bank', 'Active source account is preserved');
  assert(dup2.toAccountId === '', 'Archived target account must fallback to empty string');
}

// 7. Income transaction duplicate
{
  const incomeTx: Transaction = {
    id: 'tx_income_1',
    type: 'income',
    amount: 5000000,
    accountId: 'acc_bank',
    categoryId: 'cat_salary',
    date: Date.now(),
    note: 'Gaji Bulanan',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const dup = prepareTransactionDuplicate(incomeTx, mockAccounts, mockCategories);
  assert(dup.type === 'income', 'Type is income');
  assert(dup.amount === 5000000, 'Amount matches');
  assert(dup.accountId === 'acc_bank', 'Account matches');
  assert(dup.categoryId === 'cat_salary', 'Category matches');
  assert(dup.note === 'Gaji Bulanan', 'Note matches');
}

console.log('TransactionDuplicate asserts pass');
