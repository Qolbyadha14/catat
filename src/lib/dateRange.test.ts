import { isInRange, getPresetRange } from './dateRange';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// 1. Boundary: exactly 00:00:00.000 included
{
  const from = new Date(2026, 9, 10, 0, 0, 0, 0).getTime();
  const to = new Date(2026, 9, 12, 0, 0, 0, 0).getTime();

  assert(isInRange(from, { from, to }), 'Start boundary 00:00:00 must be included');
  assert(isInRange(from - 1, { from, to }) === false, 'One ms before start must be excluded');
}

// 2. Boundary: 23:59:59.999 included, next day 00:00:00 excluded
{
  const from = '2026-10-10';
  const to = '2026-10-12';
  const endOfDay = new Date(2026, 9, 12, 23, 59, 59, 999).getTime();
  const nextDayStart = new Date(2026, 9, 13, 0, 0, 0, 0).getTime();

  assert(isInRange(endOfDay, { from, to }), '23:59:59.999 must be included');
  assert(isInRange(nextDayStart, { from, to }) === false, 'Next day start must be excluded');
}

// 3. Invalid range: from > to rejected
{
  assert(isInRange(Date.now(), { from: '2026-10-15', to: '2026-10-10' }) === false, 'from > to must return false');
}

// 4. Presets: 7d, 30d, this_month
{
  const ref = new Date(2026, 9, 16, 15, 30, 0); // 16 Oct 2026
  const p7 = getPresetRange('7d', ref);
  assert(p7.from === new Date(2026, 9, 10, 0, 0, 0).getTime(), '7d from must be 6 days before today');
  assert(p7.to === new Date(2026, 9, 16, 0, 0, 0).getTime(), '7d to must be today');

  const p30 = getPresetRange('30d', ref);
  assert(p30.from === new Date(2026, 8, 17, 0, 0, 0).getTime(), '30d from must be 29 days before today (17 Sep)');

  const pMonth = getPresetRange('this_month', ref);
  assert(pMonth.from === new Date(2026, 9, 1, 0, 0, 0).getTime(), 'this_month from must be 1st of month');

  const pLastMonth = getPresetRange('last_month', ref);
  assert(pLastMonth.from === new Date(2026, 8, 1, 0, 0, 0).getTime(), 'last_month from must be 1st of previous month (1 Sep)');
  assert(pLastMonth.to === new Date(2026, 8, 30, 0, 0, 0).getTime(), 'last_month to must be last day of previous month (30 Sep)');
}

// 5. Null or empty range returns true (no filter)
{
  assert(isInRange(1234567, null), 'null range must allow all');
}

console.log('Date range boundary asserts pass');
