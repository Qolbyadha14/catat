export interface CategoryBudgetProgress {
  spent: number;
  monthlyBudget: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
  daysRemainingInMonth: number;
  safeDailyPace: number;
  overbudgetAmount: number;
}

/**
 * Returns the number of remaining days in the active month including the reference date.
 */
export function getDaysRemainingInMonth(refDate: Date = new Date()): number {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const currentDay = refDate.getDate();
  return Math.max(1, lastDay - currentDay + 1);
}

/**
 * Computes monthly budget progress, remaining quota, status color, and safe daily spending pace.
 */
export function computeCategoryBudget(
  spent: number,
  monthlyBudget: number,
  refDate: Date = new Date()
): CategoryBudgetProgress {
  const safeSpent = Math.max(0, spent);
  const safeBudget = Math.max(0, monthlyBudget);
  const percentage = safeBudget > 0 ? Math.round((safeSpent / safeBudget) * 100) : 0;
  const remaining = Math.max(0, safeBudget - safeSpent);
  const overbudgetAmount = Math.max(0, safeSpent - safeBudget);
  const daysRemainingInMonth = getDaysRemainingInMonth(refDate);
  const safeDailyPace = remaining > 0 ? Math.floor(remaining / daysRemainingInMonth) : 0;

  let status: 'safe' | 'warning' | 'exceeded' = 'safe';
  if (percentage >= 100) {
    status = 'exceeded';
  } else if (percentage >= 75) {
    status = 'warning';
  }

  return {
    spent: safeSpent,
    monthlyBudget: safeBudget,
    remaining,
    percentage,
    status,
    daysRemainingInMonth,
    safeDailyPace,
    overbudgetAmount,
  };
}

/**
 * Evaluates whether adding a new transaction amount will exceed the monthly budget.
 */
export function evaluateTransactionBudgetImpact(
  monthlyBudget: number | undefined,
  currentSpent: number,
  newAmount: number
): { willExceed: boolean; remainingAfter: number; overbudgetAmount: number } {
  if (!monthlyBudget || monthlyBudget <= 0) {
    return { willExceed: false, remainingAfter: 0, overbudgetAmount: 0 };
  }
  const totalAfter = currentSpent + Math.max(0, newAmount);
  const willExceed = totalAfter > monthlyBudget;
  const remainingAfter = Math.max(0, monthlyBudget - totalAfter);
  const overbudgetAmount = Math.max(0, totalAfter - monthlyBudget);
  return { willExceed, remainingAfter, overbudgetAmount };
}
