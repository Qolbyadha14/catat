import type { Transaction } from './schemas';
import { computeCategoryBudget, type CategoryBudgetProgress } from './budgeting';

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  isArchived: boolean;
  total: number;
  percentage: number;
  monthlyBudget?: number;
  budgetStatus?: 'safe' | 'warning' | 'exceeded';
  budgetRemaining?: number;
  budgetPercentage?: number;
  safeDailyPace?: number;
  overbudgetAmount?: number;
}

export interface CategoryBreakdownResult {
  totalExpense: number;
  items: CategoryBreakdownItem[];
}

export function computeCategoryBreakdown(
  transactions: Transaction[],
  categoryMap: Map<string, { name: string; icon?: string; isArchived?: boolean; monthlyBudget?: number }>,
  startOfMonth: number,
  endOfMonth?: number
): CategoryBreakdownResult {
  const end =
    endOfMonth ??
    (() => {
      const d = new Date(startOfMonth);
      return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    })();

  const expenseTxs = transactions.filter(
    (tx) => tx.type === 'expense' && tx.date >= startOfMonth && tx.date < end
  );

  let totalExpense = 0;
  const groupMap = new Map<string, number>();

  for (const tx of expenseTxs) {
    totalExpense += tx.amount;
    const catId = (tx as { categoryId: string }).categoryId;
    groupMap.set(catId, (groupMap.get(catId) ?? 0) + tx.amount);
  }

  if (totalExpense === 0) {
    return {
      totalExpense: 0,
      items: [],
    };
  }

  const items: CategoryBreakdownItem[] = [];

  for (const [catId, amount] of groupMap.entries()) {
    const catInfo = categoryMap.get(catId);
    const rawName = catInfo?.name || 'Tanpa Kategori';
    const isArchived = Boolean(catInfo?.isArchived);
    const categoryName = isArchived ? `${rawName} (Arsip)` : rawName;
    const categoryIcon = catInfo?.icon || '🏷️';
    const rawPct = Math.round((amount / totalExpense) * 100);
    const percentage = Math.min(100, Math.max(0, rawPct));

    const monthlyBudget = catInfo?.monthlyBudget;
    let budgetProgress: CategoryBudgetProgress | undefined;
    if (monthlyBudget && monthlyBudget > 0) {
      budgetProgress = computeCategoryBudget(amount, monthlyBudget, new Date(startOfMonth));
    }

    items.push({
      categoryId: catId,
      categoryName,
      categoryIcon,
      isArchived,
      total: amount,
      percentage,
      monthlyBudget: budgetProgress?.monthlyBudget,
      budgetStatus: budgetProgress?.status,
      budgetRemaining: budgetProgress?.remaining,
      budgetPercentage: budgetProgress?.percentage,
      safeDailyPace: budgetProgress?.safeDailyPace,
      overbudgetAmount: budgetProgress?.overbudgetAmount,
    });
  }

  // Sort descending by amount
  items.sort((a, b) => b.total - a.total);

  return {
    totalExpense,
    items,
  };
}
