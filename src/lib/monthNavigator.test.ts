import { shiftMonth, getMonthRange, formatMonthYear } from './monthNavigator';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// 1. Shift month anchor day 1 prevents 31st rollover bug
{
  const march31 = new Date(2026, 2, 31); // 31 March 2026
  const prevMonth = shiftMonth(march31, -1);
  assert(prevMonth.getFullYear() === 2026, 'Year must remain 2026');
  assert(prevMonth.getMonth() === 1, 'Month must be February (index 1)');
  assert(prevMonth.getDate() === 1, 'Date must be anchored to 1st');

  const august31 = new Date(2026, 7, 31); // 31 August 2026
  const nextMonth = shiftMonth(august31, 1);
  assert(nextMonth.getFullYear() === 2026, 'Year must remain 2026');
  assert(nextMonth.getMonth() === 8, 'Month must be September (index 8)');
  assert(nextMonth.getDate() === 1, 'Date must be anchored to 1st');
}

// 2. Cycle 12 months forward & backward across year boundaries
{
  let cur = new Date(2026, 0, 15); // Jan 2026
  for (let i = 0; i < 12; i++) {
    cur = shiftMonth(cur, 1);
  }
  assert(cur.getFullYear() === 2027 && cur.getMonth() === 0, '12 forward shifts from Jan 2026 must reach Jan 2027');

  for (let i = 0; i < 12; i++) {
    cur = shiftMonth(cur, -1);
  }
  assert(cur.getFullYear() === 2026 && cur.getMonth() === 0, '12 backward shifts must return to Jan 2026');
}

// 3. Month range start and end boundaries
{
  const ref = new Date(2026, 9, 20); // 20 Oct 2026
  const { startOfMonth, endOfMonth } = getMonthRange(ref);

  const expectedStart = new Date(2026, 9, 1, 0, 0, 0, 0).getTime();
  const expectedEnd = new Date(2026, 10, 1, 0, 0, 0, 0).getTime();

  assert(startOfMonth === expectedStart, 'Start of month must be Oct 1, 00:00:00');
  assert(endOfMonth === expectedEnd, 'End of month must be Nov 1, 00:00:00');

  // Year boundary (December)
  const decRef = new Date(2026, 11, 25);
  const decRange = getMonthRange(decRef);
  const expectedDecStart = new Date(2026, 11, 1, 0, 0, 0, 0).getTime();
  const expectedJanStart = new Date(2027, 0, 1, 0, 0, 0, 0).getTime();
  assert(decRange.startOfMonth === expectedDecStart, 'Dec start must be Dec 1 2026');
  assert(decRange.endOfMonth === expectedJanStart, 'Dec end must be Jan 1 2027');
}

// 4. formatMonthYear Indonesian locale
{
  const date = new Date(2026, 9, 1);
  const formatted = formatMonthYear(date);
  assert(formatted.toLowerCase().includes('oktober'), `Formatted month must contain 'oktober', got: ${formatted}`);
  assert(formatted.includes('2026'), `Formatted year must contain 2026, got: ${formatted}`);
}

console.log('Month navigator asserts pass');
