import { calculateBatchTotal, type BatchReviewItem } from './BatchReviewQueue';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// 1. calculateBatchTotal sums only active (non-excluded) items
{
  const items: Partial<BatchReviewItem>[] = [
    { id: '1', nominal: 45000, isExcluded: false },
    { id: '2', nominal: 116000, isExcluded: false },
    { id: '3', nominal: 30000, isExcluded: true },
  ];
  const total = calculateBatchTotal(items as BatchReviewItem[]);
  assert(total === 161000, `total must be 161000, got ${total}`);
}

// 2. All items excluded returns 0
{
  const items: Partial<BatchReviewItem>[] = [
    { id: '1', nominal: 50000, isExcluded: true },
    { id: '2', nominal: 25000, isExcluded: true },
  ];
  const total = calculateBatchTotal(items as BatchReviewItem[]);
  assert(total === 0, `total must be 0, got ${total}`);
}

console.log('BatchReviewQueue logic tests pass');
