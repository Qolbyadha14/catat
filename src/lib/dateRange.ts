export type DateInput = Date | number | string;

export interface DateRange {
  from: DateInput;
  to: DateInput;
}

export function parseDate(input: DateInput): Date {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const parts = input.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(input);
}

export function startOfDay(input: DateInput): number {
  const d = parseDate(input);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfNextDay(input: DateInput): number {
  const d = parseDate(input);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function isInRange(date: number, range?: DateRange | null): boolean {
  if (!range || !range.from || !range.to) return true;
  const start = startOfDay(range.from);
  const end = startOfNextDay(range.to);
  if (start >= end) return false;
  return date >= start && date < end;
}

export type PresetRange = '7d' | '30d' | 'this_month' | 'last_month';

export function getPresetRange(preset: PresetRange, now: Date = new Date()): DateRange {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (preset === '7d') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: from.getTime(), to: today.getTime() };
  }

  if (preset === '30d') {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: from.getTime(), to: today.getTime() };
  }

  if (preset === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    return { from: from.getTime(), to: today.getTime() };
  }

  if (preset === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
    const to = new Date(today.getFullYear(), today.getMonth(), 0, 0, 0, 0, 0);
    return { from: from.getTime(), to: to.getTime() };
  }

  throw new Error(`Unknown preset: ${String(preset)}`);
}
