// ponytail: pure date month navigator logic. Add min/max month limit or jump-to-today button when user asks.

export function shiftMonth(date: Date, offset: number): Date {
  // Anchor to day 1 to prevent month rollover skips on 29th/30th/31st
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function getMonthRange(date: Date): { startOfMonth: number; endOfMonth: number } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
  return { startOfMonth: start, endOfMonth: end };
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}
