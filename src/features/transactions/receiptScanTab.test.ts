import { validateReceiptFile } from '../../lib/ocrService';
import {
  canScan,
  getScanCount,
  getRemainingScans,
  recordScan,
  resetScanCounterForTest,
  hasAcceptedDisclosure,
  acceptDisclosure,
} from '../../lib/ocr/rateLimiter';
import { parseOcrReceipt } from '../../lib/ocr/schema';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// 1. Receipt File Validation Gate
{
  // Valid JPG file
  const validFile = new File([new Uint8Array(1000)], 'receipt.jpg', { type: 'image/jpeg' });
  const res1 = validateReceiptFile(validFile);
  assert(res1.valid === true, 'valid JPG file passes');

  // File > 20MB
  const largeBlob = new Uint8Array(21 * 1024 * 1024);
  const oversizedFile = new File([largeBlob], 'receipt.jpg', { type: 'image/jpeg' });
  const res2 = validateReceiptFile(oversizedFile);
  assert(res2.valid === false, 'oversized file rejected');
  assert(res2.error?.includes('20MB') === true, 'error mentions 20MB limit');

  // HEIC iPhone format rejection
  const heicFile = new File([new Uint8Array(1000)], 'struk.heic', { type: 'image/heic' });
  const res3 = validateReceiptFile(heicFile);
  assert(res3.valid === false, 'heic file rejected');
  assert(res3.error?.includes('HEIC') === true, 'error mentions HEIC');

  // Non-image text/pdf rejection
  const pdfFile = new File([new Uint8Array(1000)], 'struk.pdf', { type: 'application/pdf' });
  const res4 = validateReceiptFile(pdfFile);
  assert(res4.valid === false, 'pdf rejected');
}

// 2. Local Quota State Machine & Limit Boundary
{
  const testUid = 'user_receipt_tab_test';
  const testDate = '2026-10-17';

  if (typeof window === 'undefined' || !window.localStorage) {
    const mem = new Map<string, string>();
    const mockStorage: Storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
      clear: () => mem.clear(),
      key: (idx: number) => Array.from(mem.keys())[idx] ?? null,
      get length() {
        return mem.size;
      },
    };
    (globalThis as unknown as { window: { localStorage: Storage } }).window = {
      localStorage: mockStorage,
    };
  }

  resetScanCounterForTest(testUid, testDate);
  assert(canScan(testUid, testDate) === true, 'can scan initially');
  assert(getRemainingScans(testUid, testDate) === 20, 'remaining starts at 20');

  // Simulate scans up to 20
  for (let i = 0; i < 20; i++) {
    recordScan(testUid, testDate);
  }

  assert(getScanCount(testUid, testDate) === 20, 'count is 20');
  assert(getRemainingScans(testUid, testDate) === 0, 'remaining is 0');
  assert(canScan(testUid, testDate) === false, 'cannot scan at 20');

  // Disclosure persistence
  assert(hasAcceptedDisclosure(testUid) === false, 'initial disclosure false');
  acceptDisclosure(testUid);
  assert(hasAcceptedDisclosure(testUid) === true, 'disclosure accepted');
}

// 3. Zero Auto-Save & Form Draft Population Contract
{
  const ocrPayload = {
    amount: 87500,
    date: '2026-10-16',
    merchant: 'Superindo Express',
    confidence: 'high' as const,
  };

  const parsed = parseOcrReceipt(ocrPayload, new Date('2026-10-17T00:00:00Z'));
  assert(parsed.amount === 87500, 'amount parsed correctly');
  assert(parsed.date === '2026-10-16', 'date parsed correctly');
  assert(parsed.merchant === 'Superindo Express', 'merchant parsed correctly');
  assert(parsed.confidence === 'high', 'confidence matches');

  // Zero Auto-Save contract:
  // parseOcrReceipt ONLY creates the structured object and makes NO writes to Firestore.
}

// 4. Clipboard Image Extraction Gate
import { extractImageFileFromClipboard } from './ReceiptScanTab';

{
  const imgBlob = new Blob(['img-bytes'], { type: 'image/png' });
  const imgFile = new File([imgBlob], 'clipboard.png', { type: 'image/png' });

  // Mock DataTransfer with image item
  const mockDtWithImage = {
    items: [
      {
        type: 'image/png',
        getAsFile: () => imgFile,
      },
    ],
    files: [imgFile],
  } as unknown as DataTransfer;

  const extracted = extractImageFileFromClipboard(mockDtWithImage);
  assert(extracted !== null, 'extracts image from clipboard');
  assert(extracted?.name === 'clipboard.png', 'extracted image has correct name');

  // Mock DataTransfer with only text
  const mockDtWithText = {
    items: [
      {
        type: 'text/plain',
        getAsFile: () => new File(['hello'], 'text.txt', { type: 'text/plain' }),
      },
    ],
    files: [],
  } as unknown as DataTransfer;

  const noImage = extractImageFileFromClipboard(mockDtWithText);
  assert(noImage === null, 'returns null when no image in clipboard');

  assert(extractImageFileFromClipboard(null) === null, 'returns null for null clipboardData');
}

// 5. Multi-File Batch Validation & Quota Checks Gate
import { validateBatchFiles, checkBatchQuota } from './ReceiptScanTab';

{
  // Test empty file list
  const emptyRes = validateBatchFiles([]);
  assert(emptyRes.valid === false, 'empty batch rejected');

  // Test over limit (> 10 files)
  const elevenFiles = Array.from({ length: 11 }, (_, i) =>
    new File([new Uint8Array(100)], `receipt_${i}.jpg`, { type: 'image/jpeg' })
  );
  const overLimitRes = validateBatchFiles(elevenFiles);
  assert(overLimitRes.valid === false, 'over 10 files batch rejected');
  assert(overLimitRes.error?.includes('10') === true, 'error mentions 10 files limit');

  // Test valid batch of 3 files
  const threeValidFiles = Array.from({ length: 3 }, (_, i) =>
    new File([new Uint8Array(100)], `receipt_${i}.png`, { type: 'image/png' })
  );
  const validBatchRes = validateBatchFiles(threeValidFiles);
  assert(validBatchRes.valid === true, 'valid batch passes');

  // Test batch with one invalid file
  const mixedFiles = [
    new File([new Uint8Array(100)], 'valid.jpg', { type: 'image/jpeg' }),
    new File([new Uint8Array(100)], 'document.pdf', { type: 'application/pdf' }),
  ];
  const mixedRes = validateBatchFiles(mixedFiles);
  assert(mixedRes.valid === false, 'mixed batch with invalid file rejected');

  // Quota check: Combine mode (always 1 quota)
  const combineAllowed = checkBatchQuota(10, 3, 'combine');
  assert(combineAllowed.allowed === true, 'combine mode allowed when remaining >= 1');
  const combineExact = checkBatchQuota(1, 2, 'combine');
  assert(combineExact.allowed === true, 'combine mode allowed with remaining 1');
  const combineZero = checkBatchQuota(0, 2, 'combine');
  assert(combineZero.allowed === false, 'combine mode rejected with remaining 0');

  // Quota check: Bulk mode (needs N quotas)
  const bulkAllowed = checkBatchQuota(5, 3, 'bulk');
  assert(bulkAllowed.allowed === true, 'bulk mode allowed when remaining >= file count');
  const bulkExact = checkBatchQuota(3, 3, 'bulk');
  assert(bulkExact.allowed === true, 'bulk mode allowed with exact remaining');
  const bulkInsufficient = checkBatchQuota(2, 5, 'bulk');
  assert(bulkInsufficient.allowed === false, 'bulk mode rejected when remaining < count');
  assert(bulkInsufficient.error?.includes('2') === true, 'error mentions remaining quota');
}

console.log('ReceiptScanTab unit & validation gate tests pass');

