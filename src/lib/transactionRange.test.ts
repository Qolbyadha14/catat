import { filterTransactionsInRange } from './transactionRange';
import { test } from 'bun:test';

test('lib/transactionRange.test.ts', async () => {
function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

const range = { start: 1_000, end: 2_000 };
const dates = (items: { date: number }[]) => items.map((t) => t.date).join(',');

// 1. Batas awal inklusif, batas akhir eksklusif
{
  const items = [{ date: 999 }, { date: 1_000 }, { date: 1_999 }, { date: 2_000 }];
  assert(dates(filterTransactionsInRange(items, range)) === '1999,1000', 'includes start, excludes end');
}

// 2. Diurutkan dari yang terbaru
{
  const items = [{ date: 1_100 }, { date: 1_900 }, { date: 1_500 }];
  assert(dates(filterTransactionsInRange(items, range)) === '1900,1500,1100', 'sorts newest first');
}

// 3. Array asli tidak diubah
{
  const items = [{ date: 1_100 }, { date: 1_900 }];
  filterTransactionsInRange(items, range);
  assert(dates(items) === '1100,1900', 'does not mutate input');
}

console.log('transactionRange tests pass');
});
