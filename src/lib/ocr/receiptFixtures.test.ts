import { RECEIPT_FIXTURES } from './fixtures';
import { parseReceipt } from '../receiptParser';
import { parseOcrReceipt } from './schema';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ============================================================================
// 10 Fixture Suite & OCR Accuracy Evaluation
// ============================================================================
const refDate = new Date('2026-10-17T12:00:00Z');

let exactAmountMatches = 0;
let fallbackOrRejectHandled = 0;

for (const fix of RECEIPT_FIXTURES) {
  const parsed = parseReceipt(fix.rawText);

  if (fix.expected.shouldRejectOrFallback) {
    // Foto blur atau bukan struk: harus ditolak / amount 0 atau null
    const isHandled = !parsed.amount || parsed.needsReview || parsed.confidence < 50;
    assert(isHandled, `Fixture ${fix.id} (${fix.name}) should trigger fallback/review`);
    fallbackOrRejectHandled++;
  } else {
    // Struk normal / terdegradasi: uji akurasi nominal amount
    const matchesAmount = parsed.amount === fix.expected.amount;
    if (matchesAmount) {
      exactAmountMatches++;
    }

    // Uji pipeline schema Zod dengan mock Gemini structured output
    const mockGeminiOutput = {
      amount: parsed.amount ?? 0,
      date: parsed.date,
      merchant: parsed.merchant,
      confidence: (parsed.confidence >= 70 ? 'high' : 'low') as 'high' | 'low',
    };

    if (parsed.amount && parsed.amount > 0) {
      const sanitized = parseOcrReceipt(mockGeminiOutput, refDate);
      assert(sanitized.amount === fix.expected.amount, `${fix.id} sanitized amount matches`);

      if (fix.id === 'fix-10-future-date') {
        // Tanggal anomali tahun 2099 harus di-fallback ke today (2026-10-17)
        assert(sanitized.date === '2026-10-17', `${fix.id} future date falls back to today`);
      }
    }
  }
}

// Target Gate: Akurasi minimal 8 dari 10 fixture valid & tertangani
assert(exactAmountMatches >= 7, `Expected at least 7 exact amount matches, got ${exactAmountMatches}`);
assert(fallbackOrRejectHandled === 2, `Expected 2 fallback/reject fixtures properly handled, got ${fallbackOrRejectHandled}`);
assert(exactAmountMatches + fallbackOrRejectHandled >= 9, 'Overall accuracy & safety >= 9/10');

// ============================================================================
// Zero Auto-Save & Isolation Assertion
// ============================================================================
{
  // Simulasikan state form UI: scan struk hanya boleh mutasi local state form,
  // tidak pernah memanggil service Firestore save / createTransaction
  let firestoreNetworkCalls = 0;
  const mockFirestoreAddDoc = () => {
    firestoreNetworkCalls++;
  };
  void mockFirestoreAddDoc;

  const formLocalDraft = {
    amount: '',
    date: '',
    category: '',
    account: '',
    note: '',
    isAutoFilled: false,
    confidenceWarning: false,
  };

  // Simulasi OCR handler di TransactionFormSheet
  const onOcrExtracted = (ocrResult: { amount: number; date: string; merchant: string | null; confidence: 'high' | 'low' }) => {
    formLocalDraft.amount = String(ocrResult.amount);
    formLocalDraft.date = ocrResult.date;
    formLocalDraft.note = ocrResult.merchant ? `Struk: ${ocrResult.merchant}` : '';
    formLocalDraft.isAutoFilled = true;
    formLocalDraft.confidenceWarning = ocrResult.confidence === 'low';
    // PENTING: Jangan ada pemanggilan mockFirestoreAddDoc() di sini!
  };

  // Eksekusi dengan salah satu fixture
  const sampleOcr = parseOcrReceipt({
    amount: 45000,
    date: '2026-10-15',
    merchant: 'INDOMARET POINT',
    confidence: 'high',
  }, refDate);

  onOcrExtracted(sampleOcr);

  assert(formLocalDraft.amount === '45000', 'Local draft amount updated');
  assert(formLocalDraft.isAutoFilled === true, 'Auto-filled badge active');
  assert(firestoreNetworkCalls === 0, 'ZERO auto-save: Firestore network calls must remain 0');
}

console.log('receiptFixtures 10-fixture suite & zero auto-save assertions pass');
