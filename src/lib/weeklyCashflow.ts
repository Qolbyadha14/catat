import type { Transaction } from './schemas';

export interface WeekSummary {
  weekNumber: number;
  dateRangeLabel: string;
  startDay: number;
  endDay: number;
  income: number;
  expense: number;
  net: number;
  expenseRatio: number; // 0 to 1 relative to highest week
  incomeRatio: number;
}

export interface WeeklyCashflowData {
  weeks: WeekSummary[];
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  peakExpenseWeekNumber: number;
  maxWeeklyAmount: number;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export function computeWeeklyCashflow(
  transactions: Transaction[],
  year: number,
  month: number // 1 to 12
): WeeklyCashflowData {
  const monthIdx = month - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLabel = MONTH_NAMES_SHORT[monthIdx] || '';

  // Week boundaries: 1-7, 8-14, 15-21, 22-28, 29-end
  const weekRanges = [
    { start: 1, end: 7 },
    { start: 8, end: 14 },
    { start: 15, end: 21 },
    { start: 22, end: 28 },
    { start: 29, end: daysInMonth },
  ];

  const weeks: WeekSummary[] = weekRanges.map((r, idx) => ({
    weekNumber: idx + 1,
    dateRangeLabel: `${r.start} - ${r.end} ${monthLabel}`,
    startDay: r.start,
    endDay: r.end,
    income: 0,
    expense: 0,
    net: 0,
    expenseRatio: 0,
    incomeRatio: 0,
  }));

  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    if (txDate.getFullYear() !== year || txDate.getMonth() !== monthIdx) {
      continue;
    }

    const day = txDate.getDate();
    const weekIdx = Math.min(Math.floor((day - 1) / 7), 4);
    const targetWeek = weeks[weekIdx];

    if (tx.type === 'expense') {
      targetWeek.expense += tx.amount;
      totalExpense += tx.amount;
    } else if (tx.type === 'income') {
      targetWeek.income += tx.amount;
      totalIncome += tx.amount;
    }
  }

  let peakExpenseWeekNumber = 1;
  let maxExpense = 0;
  let maxWeeklyAmount = 0;

  for (const w of weeks) {
    w.net = w.income - w.expense;
    if (w.expense > maxExpense) {
      maxExpense = w.expense;
      peakExpenseWeekNumber = w.weekNumber;
    }
    const highestInWeek = Math.max(w.income, w.expense);
    if (highestInWeek > maxWeeklyAmount) {
      maxWeeklyAmount = highestInWeek;
    }
  }

  // Calculate normalized ratios for UI bar heights
  const divisor = maxWeeklyAmount > 0 ? maxWeeklyAmount : 1;
  for (const w of weeks) {
    w.expenseRatio = w.expense / divisor;
    w.incomeRatio = w.income / divisor;
  }

  return {
    weeks,
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    peakExpenseWeekNumber: maxExpense > 0 ? peakExpenseWeekNumber : 0,
    maxWeeklyAmount,
  };
}
