import { parseOcrReceipt, ocrReceiptSchema } from './schema';
import { calculateDimensions } from './imageProcessor';
import {
  canScan,
  getScanCount,
  getRemainingScans,
  recordScan,
  hasAcceptedDisclosure,
  acceptDisclosure,
  resetScanCounterForTest,
} from './rateLimiter';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function throws(fn: () => void) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error('Expected function to throw');
  }
}

// 1. OCR Schema & Sanitizer
{
  const refDate = new Date('2026-10-17T10:00:00Z');

  // Valid standard receipt
  const raw = {
    amount: 125000,
    date: '2026-10-15',
    merchant: 'Indomaret Point',
    confidence: 'high' as const,
  };
  const result = parseOcrReceipt(raw, refDate);
  assert(result.amount === 125000, 'amount matches');
  assert(result.date === '2026-10-15', 'date preserved');
  assert(result.merchant === 'Indomaret Point', 'merchant trimmed');
  assert(result.confidence === 'high', 'confidence high');

  // Null date fallback to today
  const nullDateRes = parseOcrReceipt(
    { amount: 45000, date: null, merchant: null, confidence: 'low' as const },
    refDate
  );
  assert(nullDateRes.date === '2026-10-17', 'fallback to today on null date');
  assert(nullDateRes.merchant === null, 'null merchant');

  // Future date fallback
  const futureRes = parseOcrReceipt(
    { amount: 99000, date: '2026-10-25', merchant: 'Resto', confidence: 'high' as const },
    refDate
  );
  assert(futureRes.date === '2026-10-17', 'future date fallback to today');

  // Next-day margin allowed
  const nextDayRes = parseOcrReceipt(
    { amount: 99000, date: '2026-10-18', merchant: 'Resto', confidence: 'high' as const },
    refDate
  );
  assert(nextDayRes.date === '2026-10-18', 'next day allowed for timezone margin');

  // Reject negative & zero amount
  throws(() => parseOcrReceipt({ amount: -5000, date: '2026-10-17', merchant: null, confidence: 'high' as const }));
  throws(() => parseOcrReceipt({ amount: 0, date: '2026-10-17', merchant: null, confidence: 'high' as const }));

  // Reject invalid confidence
  throws(() => ocrReceiptSchema.parse({ amount: 10000, date: '2026-10-17', merchant: null, confidence: 'medium' }));
}

// 2. OCR Image Processor - Dimension Calculation
{
  const d1 = calculateDimensions(800, 1200, 1600);
  assert(d1.width === 800 && d1.height === 1200, 'keep <= 1600 untouched');

  const d2 = calculateDimensions(3200, 1600, 1600);
  assert(d2.width === 1600 && d2.height === 800, 'scale down landscape');

  const d3 = calculateDimensions(2000, 4000, 1600);
  assert(d3.width === 800 && d3.height === 1600, 'scale down portrait');
}

// 3. OCR Rate Limiter & Disclosure
{
  const testUser = 'user_test_ocr_123';
  const testDate = '2026-10-17';

  if (typeof window === 'undefined' || !window.localStorage) {
    const store = new Map<string, string>();
    const mockStorage: Storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (idx: number) => Array.from(store.keys())[idx] ?? null,
      get length() {
        return store.size;
      },
    };
    (globalThis as unknown as { window: { localStorage: Storage } }).window = {
      localStorage: mockStorage,
    };
  }

  resetScanCounterForTest(testUser, testDate);
  assert(getScanCount(testUser, testDate) === 0, 'initial count 0');
  assert(getRemainingScans(testUser, testDate) === 20, 'initial remaining 20');
  assert(canScan(testUser, testDate) === true, 'initial canScan true');

  for (let i = 1; i <= 20; i++) {
    assert(canScan(testUser, testDate) === true, `canScan true at i=${i}`);
    const count = recordScan(testUser, testDate);
    assert(count === i, `count matches ${i}`);
  }

  assert(getScanCount(testUser, testDate) === 20, 'maxed out count 20');
  assert(getRemainingScans(testUser, testDate) === 0, 'remaining 0');
  assert(canScan(testUser, testDate) === false, 'canScan false after limit reached');

  // Disclosure
  assert(hasAcceptedDisclosure(testUser) === false, 'initial disclosure false');
  acceptDisclosure(testUser);
  assert(hasAcceptedDisclosure(testUser) === true, 'disclosure accepted');
}

console.log('OCR schema, imageProcessor dimensions, and rateLimiter tests pass');
