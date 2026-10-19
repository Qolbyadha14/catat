# Multi-Screenshot & Bulk Receipt Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multi-screenshot receipt scanning (combining 2+ screenshots into 1 transaction for long TikTok/Shopee receipts) and bulk receipt upload (up to 10 receipts) with an interactive Batch Review Queue and 1-tap atomic Firestore persistence.

**Architecture:** Extend `geminiService.ts` to accept `Blob | Blob[]` passing multiple image parts in a single multimodal request; update `imageProcessor.ts` to preserve minimum resolution for tall scrolling screenshots; create `BatchReviewQueue.tsx` with inline editing and exclude controls; implement `createBatchTransactions` in `transactionService.ts` using Firestore batch/transaction; wire into `ReceiptScanTab.tsx` and `TransactionFormSheet.tsx`.

**Tech Stack:** TypeScript, React 19, Firebase Firestore, Firebase AI Logic (Gemini 3.5 Flash Lite), Bun test runner, Playwright E2E.

## Global Constraints

- Zero Auto-Save: AI extractions MUST ONLY populate local review state; never write directly to Firestore without explicit user tap on "Simpan Semua" or "Simpan Transaksi".
- Quota Awareness: Multi-image single-transaction requests MUST count as exactly 1 scan against the daily quota (`OCR_DAILY_LIMIT = 20`).
- Batch Limit: Maximum 10 receipts per bulk upload batch.
- Privacy & Local Blobs: Never upload receipt images to permanent cloud storage (Firebase Storage/S3); maintain local Blob URLs.
- Design Tokens & Contrast: WCAG AA compliant (text >= 4.5:1, UI >= 3:1); zero hardcoded raw hex colors in `components.css`.

---

### Task 1: Extend Gemini Service for Multi-Blob Multimodal Requests

**Files:**
- Modify: `src/lib/ocr/geminiService.ts`
- Modify: `src/lib/ocr/geminiService.test.ts`

**Interfaces:**
- Consumes: `blobToGenerativePart(blob: Blob)`
- Produces: `scanReceiptWithGemini(blobOrBlobs: Blob | Blob[], options?: ScanOptions): Promise<OcrReceiptResult>`

- [ ] **Step 1: Write failing test in `geminiService.test.ts` for multi-blob array support**

Add assertions verifying `scanReceiptWithGemini` accepts `Blob[]` and produces a single combined `OcrReceiptResult`:

```typescript
// In src/lib/ocr/geminiService.test.ts
// Test 6: Multi-blob payload conversion
{
  const mockBlob1 = new Blob(['img1'], { type: 'image/jpeg' });
  const mockBlob2 = new Blob(['img2'], { type: 'image/jpeg' });
  const part1 = await blobToGenerativePart(mockBlob1);
  const part2 = await blobToGenerativePart(mockBlob2);
  assert(part1.type === 'inlineData' && part2.type === 'inlineData', 'converts multiple blobs to inlineData');
}
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `bun test src/lib/ocr/geminiService.test.ts`

- [ ] **Step 3: Update `scanReceiptWithGemini` signature and payload generator in `geminiService.ts`**

Allow `blobOrBlobs: Blob | Blob[]` in `scanReceiptWithGemini`. If array, map all blobs via `Promise.all(blobs.map(blobToGenerativePart))` and append the user prompt instruction to the contents array.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/ocr/geminiService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/ocr/geminiService.ts src/lib/ocr/geminiService.test.ts
git commit -m "feat(ocr): support multi-blob multimodal requests in geminiService"
```

---

### Task 2: Enhance Image Dimension Scaling for Scrolling Screenshots

**Files:**
- Modify: `src/lib/ocr/imageProcessor.ts`
- Test: `src/lib/ocr/ocr.test.ts`

**Interfaces:**
- Produces: `calculateDimensions(width: number, height: number, maxEdge?: number)`

- [ ] **Step 1: Write unit tests in `ocr.test.ts` for tall screenshot aspect ratios**

Test that tall screenshots (e.g. 1080 x 4800) are not excessively compressed horizontally:

```typescript
// In src/lib/ocr/ocr.test.ts
{
  // Very tall screenshot (scrolling receipt)
  const tall = calculateDimensions(1080, 4800, 1600);
  assert(tall.height <= 2400, 'tall screenshot height reasonable');
  assert(tall.width >= 540, 'tall screenshot preserves legible width');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/ocr/ocr.test.ts`

- [ ] **Step 3: Implement enhanced scaling in `calculateDimensions`**

For images where `height > 2 * width` (scrolling screenshots), allow `maxHeight` up to 2400 while keeping `width` at or above 540px (or original width if smaller) to prevent small text from getting blurry. Maintain exact behavior for standard ratios to preserve Gate 13 constraints.

- [ ] **Step 4: Run tests to verify all pass**

Run: `bun test src/lib/ocr/ocr.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/ocr/imageProcessor.ts src/lib/ocr/ocr.test.ts
git commit -m "feat(ocr): preserve legible width for tall scrolling screenshots"
```

---

### Task 3: Implement Atomic Batch Transactions in Service

**Files:**
- Modify: `src/features/transactions/transactionService.ts`
- Test: `src/features/transactions/transactionService.test.ts` (or add new unit test)

**Interfaces:**
- Produces: `createBatchTransactions(uid: string, items: CreateTransactionDto[]): Promise<string[]>`

- [ ] **Step 1: Write unit test for `createBatchTransactions` balance math**

Verify multiple transactions across different accounts calculate correct net balance adjustments:

```typescript
// In src/features/transactions/transactionService.test.ts
import { calculateBatchBalanceDeltas } from './transactionService';

const deltas = calculateBatchBalanceDeltas([
  { type: 'expense', amount: 50000, accountId: 'acc1', categoryId: 'cat1', date: Date.now() },
  { type: 'expense', amount: 30000, accountId: 'acc1', categoryId: 'cat1', date: Date.now() },
  { type: 'income', amount: 100000, accountId: 'acc2', categoryId: 'cat2', date: Date.now() },
]);
assert(deltas['acc1'] === -80000, 'acc1 delta correct');
assert(deltas['acc2'] === 100000, 'acc2 delta correct');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/transactionService.test.ts`

- [ ] **Step 3: Implement `calculateBatchBalanceDeltas` and `createBatchTransactions`**

In `src/features/transactions/transactionService.ts`:
- Export pure helper `calculateBatchBalanceDeltas` for testability.
- Implement `createBatchTransactions(uid, items)` using Firestore `writeBatch` or `runTransaction` to update all accounts and add all transaction records atomically.

- [ ] **Step 4: Run tests to verify all pass**

Run: `bun test src/features/transactions/`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/features/transactions/transactionService.ts src/features/transactions/transactionService.test.ts
git commit -m "feat(transactions): implement atomic batch transaction creation and delta math"
```

---

### Task 4: Create BatchReviewQueue Component & Styles

**Files:**
- Create: `src/features/transactions/BatchReviewQueue.tsx`
- Create: `src/features/transactions/BatchReviewQueue.test.ts`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `OcrReceiptResult`, `Category[]`, `Account[]`
- Produces: `BatchReviewQueue` component with props:
  - `items: BatchReviewItem[]`
  - `categories: Category[]`
  - `accounts: Account[]`
  - `onUpdateItem: (id: string, updates: Partial<BatchReviewItem>) => void`
  - `onRemoveItem: (id: string) => void`
  - `onSaveAll: () => Promise<void>`
  - `onCancel: () => void`
  - `isSaving: boolean`

- [ ] **Step 1: Write unit test for `BatchReviewQueue` logic in `BatchReviewQueue.test.ts`**

Test item exclusion, item updates, and total nominal calculation:

```typescript
// src/features/transactions/BatchReviewQueue.test.ts
import { calculateBatchTotal } from './BatchReviewQueue';

const items = [
  { id: '1', nominal: 45000, isExcluded: false },
  { id: '2', nominal: 116000, isExcluded: false },
  { id: '3', nominal: 30000, isExcluded: true },
];
const total = calculateBatchTotal(items);
assert(total === 161000, 'excludes disabled items from batch total');
console.log('BatchReviewQueue logic tests pass');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/BatchReviewQueue.test.ts`

- [ ] **Step 3: Implement `BatchReviewQueue.tsx` and CSS styles**

- Build cards for each detected receipt with:
  - Mini thumbnail.
  - Merchant name input & date picker.
  - Nominal input with fast inline editing.
  - Category selector chip / dropdown and Account selector.
  - Delete row button (`✕`).
- Bottom bar with:
  - Total items & sum (`Total: Rp 161.000 (2 transaksi)`).
  - Button "Batal" and Primary CTA **"Simpan Semua (N)"**.
- In `src/styles/components.css`: Add styles using semantic tokens (`var(--surface)`, `var(--primary)`, etc.) with zero raw hex codes.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/transactions/BatchReviewQueue.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/features/transactions/BatchReviewQueue.tsx src/features/transactions/BatchReviewQueue.test.ts src/styles/components.css
git commit -m "feat(ui): create BatchReviewQueue component and styles"
```

---

### Task 5: Upgrade ReceiptScanTab for Multi-File Selection & Mode Switcher

**Files:**
- Modify: `src/features/transactions/ReceiptScanTab.tsx`
- Modify: `src/features/transactions/receiptScanTab.test.ts`

**Interfaces:**
- Produces: Multi-file selection, combine toggle, and callback `onBatchComplete(results: Array<{ result: OcrReceiptResult; previewUrl: string }>)`.

- [ ] **Step 1: Write unit test in `receiptScanTab.test.ts` for multi-file state handling**

Test multi-file extraction queue and mode toggles.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/receiptScanTab.test.ts`

- [ ] **Step 3: Implement multi-file upload & mode toggle in `ReceiptScanTab.tsx`**

- Add `multiple` attribute to `<input type="file" accept="image/*" multiple />`.
- Add Mode Toggle when 2+ files are selected:
  - `[🔘 Gabungkan jadi 1 Transaksi]` (Multi-image for long TikTok receipts)
  - `[⚪ Pisahkan per Transaksi]` (Bulk upload)
- Support drag-and-drop of multiple files.
- Support pasting multiple images from clipboard.
- For combined mode: Call `scanReceiptWithGemini([blob1, blob2])` and pass to standard `onScanComplete`.
- For bulk mode: Loop with concurrency limit, show progress bar (`Mengekstrak 3 dari 5...`), and trigger `onBatchComplete(batchItems)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/transactions/receiptScanTab.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/features/transactions/ReceiptScanTab.tsx src/features/transactions/receiptScanTab.test.ts
git commit -m "feat(ocr): add multi-file selection and combine toggle to ReceiptScanTab"
```

---

### Task 6: Wire BatchReviewQueue into TransactionFormSheet

**Files:**
- Modify: `src/features/transactions/TransactionFormSheet.tsx`

- [ ] **Step 1: Add batch review state to `TransactionFormSheet.tsx`**

- State: `batchQueue: BatchReviewItem[] | null`.
- Pass `onBatchComplete` to `ReceiptScanTab`.
- When `batchQueue` is active, render `BatchReviewQueue` in the sheet body.
- Implement `handleSaveBatch`:
  - Filter out `isExcluded` items.
  - Call `createBatchTransactions(uid, payloads)`.
  - Trigger `onSuccess` and `onClose`.

- [ ] **Step 2: Run unit tests across features**

Run: `bun test src/`
Expected: PASS

- [ ] **Step 3: Commit changes**

```bash
git add src/features/transactions/TransactionFormSheet.tsx
git commit -m "feat(ui): wire BatchReviewQueue into TransactionFormSheet"
```

---

### Task 7: Comprehensive Verification & Quality Gates

**Files:**
- Test all test suites and gate checkers

- [ ] **Step 1: Run all unit tests**

Run: `bun test src/`
Expected: All unit test files PASS with 0 failures.

- [ ] **Step 2: Run live OCR test**

Run: `npm run test:ocr-live`
Expected: All live OCR assertions PASS.

- [ ] **Step 3: Run full E2E quality gates (Gate 1 - 13)**

Run: `npm run test:e2e`
Expected: 13/13 gates PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: `tsc -b && vite build` succeeds with zero errors.

- [ ] **Step 5: Commit final adjustments**

```bash
git add -A
git commit -m "chore: final verification for multi-screenshot and bulk receipt upload"
```
