/** Rentang setengah terbuka: start inklusif, end eksklusif (epoch ms). */
export interface TransactionRange {
  start: number;
  end: number;
}

export function filterTransactionsInRange<T extends { date: number }>(
  items: readonly T[],
  range: TransactionRange
): T[] {
  return items
    .filter((item) => item.date >= range.start && item.date < range.end)
    .sort((a, b) => b.date - a.date);
}
