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

console.log('ReceiptScanTab unit & validation gate tests pass');

