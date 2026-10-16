import type { Transaction } from './schemas';
import { isInRange, getPresetRange, type PresetRange } from './dateRange';

export type FilterType = 'all' | 'expense' | 'income';
export type FilterDatePreset = 'all' | 'this_month' | 'last_month' | 'custom';

export interface FilterCriteria {
  keyword: string;
  type: FilterType;
  accountIds: string[];
  categoryIds: string[];
  datePreset: FilterDatePreset;
  customRange: { from: string; to: string } | null;
}

export const DEFAULT_FILTER_CRITERIA: FilterCriteria = {
  keyword: '',
  type: 'all',
  accountIds: [],
  categoryIds: [],
  datePreset: 'all',
  customRange: null,
};

export function countActiveFilters(criteria: FilterCriteria): number {
  let count = 0;
  if (criteria.type !== 'all') count++;
  if (criteria.accountIds.length > 0) count++;
  if (criteria.categoryIds.length > 0) count++;
  if (criteria.datePreset !== 'all') count++;
  return count;
}

export function filterTransactions(
  transactions: Transaction[],
  criteria: FilterCriteria,
  accountMap: Map<string, { name: string; isArchived?: boolean }>,
  categoryMap: Map<string, { name: string; icon?: string; isArchived?: boolean }>
): Transaction[] {
  const activeRange =
    criteria.datePreset === 'all'
      ? null
      : criteria.datePreset === 'custom'
      ? criteria.customRange
      : getPresetRange(criteria.datePreset as PresetRange);

  const query = criteria.keyword.trim().toLowerCase();

  return transactions.filter((tx) => {
    // 1. Type filter
    if (criteria.type !== 'all' && tx.type !== criteria.type) {
      return false;
    }

    // 2. Account filter (multi-select)
    if (criteria.accountIds.length > 0) {
      if (tx.type === 'transfer') {
        const matchesFrom = criteria.accountIds.includes(tx.fromAccountId);
        const matchesTo = criteria.accountIds.includes(tx.toAccountId);
        if (!matchesFrom && !matchesTo) return false;
      } else {
        if (!criteria.accountIds.includes(tx.accountId)) return false;
      }
    }

    // 3. Category filter (multi-select)
    if (criteria.categoryIds.length > 0) {
      if (tx.type === 'transfer') return false;
      if (!criteria.categoryIds.includes(tx.categoryId)) return false;
    }

    // 4. Keyword search (note, category name, or account name)
    if (query) {
      const noteMatch = tx.note ? tx.note.toLowerCase().includes(query) : false;
      let nameMatch = false;
      if (tx.type === 'transfer') {
        const fromAcc = accountMap.get(tx.fromAccountId);
        const toAcc = accountMap.get(tx.toAccountId);
        const fromName = fromAcc
          ? `${fromAcc.name}${fromAcc.isArchived ? ' (arsip)' : ''}`.toLowerCase()
          : '';
        const toName = toAcc
          ? `${toAcc.name}${toAcc.isArchived ? ' (arsip)' : ''}`.toLowerCase()
          : '';
        nameMatch = fromName.includes(query) || toName.includes(query);
      } else {
        const cat = categoryMap.get(tx.categoryId);
        const acc = accountMap.get(tx.accountId);
        const catName = cat
          ? `${cat.name}${cat.isArchived ? ' (arsip)' : ''}`.toLowerCase()
          : '';
        const accName = acc
          ? `${acc.name}${acc.isArchived ? ' (arsip)' : ''}`.toLowerCase()
          : '';
        nameMatch = catName.includes(query) || accName.includes(query);
      }
      if (!noteMatch && !nameMatch) return false;
    }

    // 5. Date range filter
    if (!isInRange(tx.date, activeRange)) {
      return false;
    }

    return true;
  });
}
