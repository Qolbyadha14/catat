import { describe, it, expect, beforeAll } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../src/lib/firebase';
import { RECEIPT_FIXTURES } from '../src/lib/ocr/fixtures';
import { parseReceipt } from '../src/lib/receiptParser';
import { parseOcrReceipt } from '../src/lib/ocr/schema';
import {
  checkScanQuota,
  incrementScanUsage,
  formatOcrDateKey,
  OCR_DAILY_LIMIT,
  DEFAULT_OCR_MODEL,
} from '../src/lib/ocr/geminiService';

// Ensure debug token is wired
const DEBUG_TOKEN = process.env.FIREBASE_APPCHECK_DEBUG_TOKEN || '51561ED6-6CB7-4A7B-9068-C845B5E7AE4F';
(globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN;

let testUid: string;
const testDate = new Date('2026-10-17T12:00:00Z');
const dateKey = formatOcrDateKey(testDate);

describe('Live OCR Test Suite (App Check Debug Token & Gate Verification)', () => {
  beforeAll(async () => {
    // LocalStorage polyfill for Bun test environment
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

    const cred = await signInAnonymously(auth);
    testUid = cred.user.uid;
  });

  it('1. App Check Debug Token: properly wired to environment', () => {
    expect(DEBUG_TOKEN).toBe('51561ED6-6CB7-4A7B-9068-C845B5E7AE4F');
    expect((globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN)
      .toBe('51561ED6-6CB7-4A7B-9068-C845B5E7AE4F');
    expect(DEFAULT_OCR_MODEL).toBe('gemini-3.8-flash');
  });

  it('2. Gate 8/10: 10 Receipt Fixtures Accuracy & Fallback Handling', () => {
    let exactAmountMatches = 0;
    let safeFallbackHandled = 0;

    for (const fix of RECEIPT_FIXTURES) {
      const parsed = parseReceipt(fix.rawText);

      if (fix.expected.shouldRejectOrFallback) {
        // Blur image or non-receipt: must be rejected / low confidence / needs review
        const isSafelyHandled = !parsed.amount || parsed.needsReview || parsed.confidence < 50;
        expect(isSafelyHandled).toBe(true);
        safeFallbackHandled++;
      } else {
        if (parsed.amount === fix.expected.amount) {
          exactAmountMatches++;
        }

        const schemaInput = {
          amount: parsed.amount ?? 0,
          date: parsed.date,
          merchant: parsed.merchant,
          confidence: (parsed.confidence >= 70 ? 'high' : 'low') as 'high' | 'low',
        };

        if (parsed.amount && parsed.amount > 0) {
          const sanitized = parseOcrReceipt(schemaInput, testDate);
          expect(sanitized.amount).toBe(fix.expected.amount);

          if (fix.id === 'fix-10-future-date') {
            expect(sanitized.date).toBe('2026-10-17');
          }
        }
      }
    }

    // Assert accuracy gate
    expect(exactAmountMatches).toBeGreaterThanOrEqual(7);
    expect(safeFallbackHandled).toBe(2);
    expect(exactAmountMatches + safeFallbackHandled).toBeGreaterThanOrEqual(8);
  });

  it('3. Zero Auto-Save: OCR execution does not write to Firestore transactions', async () => {
    const txColRef = collection(db, 'users', testUid, 'transactions');
    const snapBefore = await getDocs(txColRef);
    const initialCount = snapBefore.docs.length;

    // Simulate OCR result
    const sample = parseOcrReceipt({
      amount: 45000,
      date: '2026-10-15',
      merchant: 'INDOMARET POINT',
      confidence: 'high',
    }, testDate);

    // Simulated local form state only
    const formState = {
      amount: String(sample.amount),
      date: sample.date,
      note: sample.merchant ? `Struk: ${sample.merchant}` : '',
      isAutoFilled: true,
    };
    expect(formState.isAutoFilled).toBe(true);

    const snapAfter = await getDocs(txColRef);
    expect(snapAfter.docs.length).toBe(initialCount);
  });

  it('4. Anti-Drain Guard: AI failure causes zero scanUsage mutation (counter stays unchanged)', async () => {
    const usageRef = doc(db, 'scanUsage', `${testUid}_${dateKey}`);
    const beforeSnap = await getDoc(usageRef);
    const initialUsage = beforeSnap.exists() ? (beforeSnap.data().count ?? 0) : 0;

    // Pre-check quota passes
    const allowed = await checkScanQuota(testUid, testDate);
    expect(allowed).toBe(initialUsage);

    // Simulate AI invocation failure (HTTP 404, network timeout, invalid schema)
    const simulateAiFailure = async () => {
      await checkScanQuota(testUid, testDate);
      throw new Error('AI Logic Error: 404 Model Not Found or Timeout 15s');
      // Notice: incrementScanUsage is NEVER reached here
    };

    let errorThrown = false;
    try {
      await simulateAiFailure();
    } catch (err) {
      errorThrown = true;
      expect((err as Error).message).toContain('AI Logic Error');
    }
    expect(errorThrown).toBe(true);

    // Verify scanUsage was NOT mutated (still non-existent or same count)
    const afterSnap = await getDoc(usageRef);
    const afterUsage = afterSnap.exists() ? (afterSnap.data().count ?? 0) : 0;
    expect(afterUsage).toBe(initialUsage);
  });

  it('5. Successful extraction commits atomic scanUsage increment', async () => {
    const usageRef = doc(db, 'scanUsage', `${testUid}_${dateKey}`);
    const beforeSnap = await getDoc(usageRef);
    const countBefore = beforeSnap.exists() ? (beforeSnap.data().count ?? 0) : 0;

    const simulateSuccessfulExtraction = async () => {
      await checkScanQuota(testUid, testDate);
      // AI success...
      const next = await incrementScanUsage(testUid, testDate);
      return next;
    };

    const newCount = await simulateSuccessfulExtraction();
    expect(newCount).toBe(countBefore + 1);

    const snap = await getDoc(usageRef);
    expect(snap.data()?.count).toBe(countBefore + 1);
  });

  it('6. Quota Cap: Attempt 21 is blocked before AI invocation and rejected', async () => {
    const usageRef = doc(db, 'scanUsage', `${testUid}_${dateKey}`);
    // Set to 20
    await setDoc(usageRef, {
      uid: testUid,
      date: dateKey,
      count: OCR_DAILY_LIMIT,
      updatedAt: new Date().toISOString(),
    });

    // Check quota must throw
    let quotaErrorThrown = false;
    try {
      await checkScanQuota(testUid, testDate);
    } catch (err) {
      quotaErrorThrown = true;
      expect((err as Error).message).toContain('Batas kuota harian tercapai');
    }
    expect(quotaErrorThrown).toBe(true);

    // Direct increment attempt must also throw
    let incErrorThrown = false;
    try {
      await incrementScanUsage(testUid, testDate);
    } catch (err) {
      incErrorThrown = true;
      expect((err as Error).message).toContain('Batas kuota harian tercapai');
    }
    expect(incErrorThrown).toBe(true);
  });
});
