import type { Account, Category, Transaction } from './schemas';

export interface DuplicateFormValues {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  note: string;
  date: Date;
}

/**
 * Prepares prefilled values for duplicating an existing transaction.
 *
 * Rules:
 * 1. date = new Date() (today)
 * 2. id is omitted (treated as new transaction, prevents mutating original)
 * 3. archived accounts/categories fallback to empty string so user re-selects
 * 4. dual-leg transfer handles fromAccountId and toAccountId independently
 */
export function prepareTransactionDuplicate(
  tx: Transaction,
  accounts: Account[],
  categories: Category[]
): DuplicateFormValues {
  const activeAccountSet = new Set(
    accounts.filter((a) => !a.isArchived).map((a) => a.id)
  );

  const amount = tx.amount;
  const note = tx.note ?? '';
  const date = new Date();

  if (tx.type === 'transfer') {
    return {
      type: 'transfer',
      amount,
      accountId: activeAccountSet.has(tx.fromAccountId) ? tx.fromAccountId : '',
      toAccountId: activeAccountSet.has(tx.toAccountId) ? tx.toAccountId : '',
      categoryId: '',
      note,
      date,
    };
  }

  const activeCategorySet = new Set(
    categories
      .filter((c) => !c.isArchived && c.type === tx.type)
      .map((c) => c.id)
  );

  return {
    type: tx.type,
    amount,
    accountId: activeAccountSet.has(tx.accountId) ? tx.accountId : '',
    toAccountId: '',
    categoryId: activeCategorySet.has(tx.categoryId) ? tx.categoryId : '',
    note,
    date,
  };
}
