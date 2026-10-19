# Intelligent Digital Receipt Autofill & Modern Input UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement context-aware digital receipt OCR autofill (Category & Account matching for ShopeeFood, GoFood, SPayLater, Bank Jago, etc.), post-scan Review Card with 1-tap quick save, visual category chip grid with AI recommendation glow, account pill selector with real balances, and clipboard screenshot paste.

**Architecture:** Client-side multimodal extraction via Firebase AI Logic (Gemini 3.5 Flash Lite) with dynamic user category & account schema context; intermediate `OcrReviewCard` state preserving the zero auto-save guarantee; ergonomic mobile-first visual selectors (`CategoryChipGrid`, `AccountPillSelector`) replacing native `<select>` dropdowns; global and sheet-level clipboard event listener.

**Tech Stack:** TypeScript, React 19, Zod, Firebase AI Logic (@firebase/vertexai or firebase/ai), Bun test runner, Playwright E2E.

## Global Constraints

- Zero Auto-Save: AI extractions MUST ONLY pre-fill local state; never commit directly to Firestore without explicit user tap on "Simpan Langsung" or "Simpan Transaksi".
- Privacy & Storage: Do NOT upload raw receipt images to permanent cloud storage (Firebase Storage/S3/R2); keep images local via Blob/Object URLs and base64 inline AI payloads.
- Preserved Gates: All 21 existing unit test files, `test:ocr-live`, and 13 Playwright E2E scenarios MUST pass with zero regressions.
- Mobile Ergonomics: Touch targets MUST meet minimum 44px height; responsive across 360px - 1440px viewport widths.

---

### Task 1: Extend OCR Schema & Gemini Service for Category & Account Autofill

**Files:**
- Modify: `src/lib/ocr/schema.ts`
- Modify: `src/lib/ocr/geminiService.ts`
- Modify: `src/lib/ocr/geminiService.test.ts`

**Interfaces:**
- Consumes: `Category` (`{ id, name, type }`), `Account` (`{ id, name, kind }`) from `src/lib/schemas.ts`.
- Produces: `OcrReceiptResult` updated with `categoryId`, `accountId`, `platform`, `paymentMethod`, `suggestedType`.

- [x] **Step 1: Write the failing test for extended schema & prompt generator**

Update `src/lib/ocr/geminiService.test.ts` with assertions for `parseOcrReceipt` with new fields and `buildOcrPrompt` context builder:

```typescript
// Add to src/lib/ocr/geminiService.test.ts
import { parseOcrReceipt } from './schema';
import { buildOcrSystemInstruction } from './geminiService';

// Test 5: parseOcrReceipt with category, account, and platform
{
  const mockAiOutput = {
    amount: 45000,
    date: '2026-10-19',
    merchant: 'Kopi Kenangan Grand Indonesia',
    categoryId: 'cat_food_123',
    accountId: 'acc_jago_456',
    platform: 'shopeefood',
    paymentMethod: 'ShopeePay',
    suggestedType: 'expense',
  };
  const parsed = parseOcrReceipt(mockAiOutput);
  assert(parsed.amount === 45000, 'amount parsed correctly');
  assert(parsed.categoryId === 'cat_food_123', 'categoryId parsed');
  assert(parsed.accountId === 'acc_jago_456', 'accountId parsed');
  assert(parsed.platform === 'shopeefood', 'platform parsed');
  assert(parsed.paymentMethod === 'ShopeePay', 'paymentMethod parsed');
  assert(parsed.suggestedType === 'expense', 'suggestedType parsed');
}

// Test 6: buildOcrSystemInstruction generates rich Indonesian context
{
  const categories = [{ id: 'c1', name: 'Makan & Minum', type: 'expense' as const }];
  const accounts = [{ id: 'a1', name: 'Bank Jago', kind: 'asset' as const }];
  const prompt = buildOcrSystemInstruction(categories, accounts);
  assert(prompt.includes('Makan & Minum'), 'prompt contains category name');
  assert(prompt.includes('Bank Jago'), 'prompt contains account name');
  assert(prompt.includes('ShopeeFood'), 'prompt contains platform guidance');
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/ocr/geminiService.test.ts`
Expected: FAIL with missing exports or schema validation errors.

- [x] **Step 3: Implement extended schema in `src/lib/ocr/schema.ts` and `src/lib/ocr/geminiService.ts`**

In `src/lib/ocr/schema.ts`:
```typescript
import { z } from 'zod';

export const ocrReceiptSchema = z.object({
  amount: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  merchant: z.string().trim().max(100).nullable().default(null),
  categoryId: z.string().trim().nullable().default(null),
  accountId: z.string().trim().nullable().default(null),
  platform: z.enum(['shopeefood', 'gofood', 'spaylater', 'tiktok', 'bank_jago', 'qris', 'other']).default('other'),
  paymentMethod: z.string().trim().max(50).nullable().default(null),
  suggestedType: z.enum(['expense', 'transfer']).default('expense'),
});

export type OcrReceiptResult = z.infer<typeof ocrReceiptSchema> & {
  confidence: 'high' | 'low';
};
```

In `src/lib/ocr/geminiService.ts`, implement `buildOcrSystemInstruction(categories, accounts)` and pass it into `getGeminiModel` / generation prompt.

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/ocr/geminiService.test.ts`
Expected: PASS.

- [x] **Step 5: Commit changes**

```bash
git add src/lib/ocr/schema.ts src/lib/ocr/geminiService.ts src/lib/ocr/geminiService.test.ts
git commit -m "feat(ocr): add context-aware category and account schema extraction"
```

---

### Task 2: Build `CategoryChipGrid` Component

**Files:**
- Create: `src/features/transactions/CategoryChipGrid.tsx`
- Create: `src/features/transactions/CategoryChipGrid.test.ts`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `categories: Category[]`, `selectedId: string`, `onSelect: (id: string) => void`, `recommendedId?: string | null`, `type: 'expense' | 'income'`.
- Produces: Visual grid of category chips with icons, active state, and AI recommendation badge.

- [x] **Step 1: Write the failing unit test for `CategoryChipGrid` logic**

Create `src/features/transactions/CategoryChipGrid.test.ts`:
```typescript
import { filterCategoriesByType, getRecommendedCategory } from './CategoryChipGrid';
import type { Category } from '../../lib/schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

const mockCategories: Category[] = [
  { id: 'c1', name: 'Makan & Minum', type: 'expense', icon: '🍔', isArchived: false, createdAt: 1 },
  { id: 'c2', name: 'Gaji', type: 'income', icon: '💰', isArchived: false, createdAt: 1 },
  { id: 'c3', name: 'Archived Cat', type: 'expense', icon: '📦', isArchived: true, createdAt: 1 },
];

// Test 1: filter active categories by transaction type
const expenseCats = filterCategoriesByType(mockCategories, 'expense');
assert(expenseCats.length === 1 && expenseCats[0].id === 'c1', 'filters out archived and non-matching types');

// Test 2: AI recommendation resolver
const rec = getRecommendedCategory(expenseCats, 'c1');
assert(rec?.id === 'c1', 'resolves recommended category');

console.log('CategoryChipGrid logic tests pass');
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/CategoryChipGrid.test.ts`
Expected: FAIL with missing module.

- [x] **Step 3: Implement `CategoryChipGrid.tsx` and styling**

Create `src/features/transactions/CategoryChipGrid.tsx` exporting `filterCategoriesByType`, `getRecommendedCategory`, and the `CategoryChipGrid` React component.
Add responsive styles in `src/styles/components.css` for `.category-chip-grid`, `.category-chip`, `.category-chip.active`, and `.category-chip.recommended-ai`.

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/features/transactions/CategoryChipGrid.test.ts`
Expected: PASS.

- [x] **Step 5: Commit changes**

```bash
git add src/features/transactions/CategoryChipGrid.tsx src/features/transactions/CategoryChipGrid.test.ts src/styles/components.css
git commit -m "feat(ui): create CategoryChipGrid with AI recommendation badge"
```

---

### Task 3: Build `AccountPillSelector` Component

**Files:**
- Create: `src/features/transactions/AccountPillSelector.tsx`
- Create: `src/features/transactions/AccountPillSelector.test.ts`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `accounts: Account[]`, `selectedId: string`, `onSelect: (id: string) => void`, `label: string`, `excludeId?: string`.
- Produces: Horizontal/flex pill selector showing account icon, name, formatted balance, and kind badge (`Kas` vs `PayLater`).

- [x] **Step 1: Write the failing unit test for `AccountPillSelector` logic**

Create `src/features/transactions/AccountPillSelector.test.ts`:
```typescript
import { filterSelectableAccounts, getAccountKindBadge } from './AccountPillSelector';
import type { Account } from '../../lib/schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

const mockAccounts: Account[] = [
  { id: 'a1', name: 'Bank Jago', kind: 'asset', balance: 1500000, createdAt: 1, isArchived: false },
  { id: 'a2', name: 'SPayLater', kind: 'liability', balance: -250000, createdAt: 1, isArchived: false },
  { id: 'a3', name: 'Old Bank', kind: 'asset', balance: 0, createdAt: 1, isArchived: true },
];

// Test 1: filters out archived and excluded accounts
const selectable = filterSelectableAccounts(mockAccounts, 'a1');
assert(selectable.length === 1 && selectable[0].id === 'a2', 'excludes archived and excludeId');

// Test 2: badges
assert(getAccountKindBadge('asset').label === 'Kas', 'asset badge is Kas');
assert(getAccountKindBadge('liability').label === 'PayLater', 'liability badge is PayLater');

console.log('AccountPillSelector logic tests pass');
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/AccountPillSelector.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement `AccountPillSelector.tsx` and styling**

Create `src/features/transactions/AccountPillSelector.tsx` with clean pill cards, active ring, balance display, and accessible keyboard navigation.
Add styling in `src/styles/components.css`.

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/features/transactions/AccountPillSelector.test.ts`
Expected: PASS.

- [x] **Step 5: Commit changes**

```bash
git add src/features/transactions/AccountPillSelector.tsx src/features/transactions/AccountPillSelector.test.ts src/styles/components.css
git commit -m "feat(ui): create AccountPillSelector with balance and asset/liability tags"
```

---

### Task 4: Build `OcrReviewCard` Component

**Files:**
- Create: `src/features/transactions/OcrReviewCard.tsx`
- Create: `src/features/transactions/OcrReviewCard.test.ts`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes:
  - `result: OcrReceiptResult`
  - `previewUrl: string | null`
  - `categoryName?: string`
  - `accountName?: string`
  - `onQuickSave: () => void`
  - `onEditDetails: () => void`
- Produces: Post-scan review card with thumbnail, platform tag, detected amount, category & account chips, and "Simpan Langsung" (1-tap) / "Sesuaikan Detail" actions.

- [x] **Step 1: Write the failing unit test for `OcrReviewCard` data formatting**

Create `src/features/transactions/OcrReviewCard.test.ts`:
```typescript
import { formatPlatformBadge, formatReviewNote } from './OcrReviewCard';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

assert(formatPlatformBadge('shopeefood') === 'ShopeeFood', 'formats shopeefood badge');
assert(formatPlatformBadge('bank_jago') === 'Bank Jago', 'formats bank_jago badge');
assert(formatPlatformBadge('spaylater') === 'SPayLater', 'formats spaylater badge');

const note = formatReviewNote('Kopi Kenangan', 'ShopeePay', 'shopeefood');
assert(note.includes('Kopi Kenangan'), 'includes merchant');
assert(note.includes('ShopeeFood'), 'includes platform');

console.log('OcrReviewCard logic tests pass');
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/OcrReviewCard.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement `OcrReviewCard.tsx` and styling**

Create `src/features/transactions/OcrReviewCard.tsx`.
Add styles in `src/styles/components.css` for `.ocr-review-card`, `.ocr-thumbnail`, `.ocr-summary-grid`, and `.ocr-review-actions`.

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/features/transactions/OcrReviewCard.test.ts`
Expected: PASS.

- [x] **Step 5: Commit changes**

```bash
git add src/features/transactions/OcrReviewCard.tsx src/features/transactions/OcrReviewCard.test.ts src/styles/components.css
git commit -m "feat(ui): create OcrReviewCard for fast 1-tap post-scan confirmation"
```

---

### Task 5: Integrate Clipboard Paste & Context into `ReceiptScanTab`

**Files:**
- Modify: `src/features/transactions/ReceiptScanTab.tsx`
- Modify: `src/features/transactions/receiptScanTab.test.ts`

**Interfaces:**
- Consumes: `categories: Category[]`, `accounts: Account[]` passed from parent.
- Produces: Global paste handler (`Cmd+V` / `Ctrl+V`), image thumbnail extraction, and passing categories/accounts to `scanReceiptWithGemini`.

- [x] **Step 1: Update `receiptScanTab.test.ts` with clipboard image detection tests**

Add test in `receiptScanTab.test.ts`:
```typescript
import { extractImageFileFromClipboardData } from './ReceiptScanTab';

// Mock clipboard item
const mockBlob = new Blob(['img'], { type: 'image/png' });
const mockFile = new File([mockBlob], 'screenshot.png', { type: 'image/png' });

const extracted = extractImageFileFromClipboardData([mockFile]);
assert(extracted !== null && extracted.type.startsWith('image/'), 'extracts image from clipboard items');

const textFile = new File(['text'], 'notes.txt', { type: 'text/plain' });
assert(extractImageFileFromClipboardData([textFile]) === null, 'ignores non-image clipboard files');
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/receiptScanTab.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement clipboard paste and context passing in `ReceiptScanTab.tsx`**

1. Export `extractImageFileFromClipboardData`.
2. Add `window.addEventListener('paste', handleGlobalPaste)` during active tab.
3. Accept `categories` and `accounts` in `ReceiptScanTabProps` and pass to `scanReceiptWithGemini(resized.blob, uid, { categories, accounts, ... })`.
4. Include `previewUrl` in scan result callback so `OcrReviewCard` can display receipt thumbnail.

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/features/transactions/receiptScanTab.test.ts`
Expected: PASS.

- [x] **Step 5: Commit changes**

```bash
git add src/features/transactions/ReceiptScanTab.tsx src/features/transactions/receiptScanTab.test.ts
git commit -m "feat(ocr): add clipboard paste support and context passing to ReceiptScanTab"
```

---

### Task 6: Integrate Review Card & Visual Selectors into `TransactionFormSheet`

**Files:**
- Modify: `src/features/transactions/TransactionFormSheet.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Integrates `OcrReviewCard`, `CategoryChipGrid`, and `AccountPillSelector`.
- Handles 1-tap "Simpan Langsung" from Review Card (validating and saving immediately).
- Handles "Sesuaikan Detail" (pre-populating fields and opening manual form).
- Adds quick amount helper buttons (`+10rb`, `+50rb`, `+100rb`).

- [x] **Step 1: Write integration tests for quick save & autofill pre-population**

Add tests validating:
1. `onScanSuccess` populates `categoryId`, `accountId`, `type`, `amount`, `date`, `note`.
2. Quick save execution directly triggers `createTransaction` without manual tab entry.

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/`
Expected: FAIL.

- [x] **Step 3: Implement wiring in `TransactionFormSheet.tsx`**

1. Replace `<select id="categoryId">` with `<CategoryChipGrid>`.
2. Replace `<select id="accountId">` and `<select id="toAccountId">` with `<AccountPillSelector>`.
3. Add quick add buttons under amount input (`+10k`, `+50k`, `+100k`).
4. Display `OcrReviewCard` when scan succeeds, offering "Simpan Langsung" and "Sesuaikan Detail".

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/`
Expected: PASS.

- [x] **Step 5: Commit changes**

```bash
git add src/features/transactions/TransactionFormSheet.tsx src/styles/components.css
git commit -m "feat(ui): wire OcrReviewCard, CategoryChipGrid, and AccountPillSelector into TransactionFormSheet"
```

---

### Task 7: Full Test Suite & E2E Verification

**Files:**
- Run: `bun test src/`
- Run: `npm run test:ocr-live`
- Run: `npm run test:e2e`

- [x] **Step 1: Run all unit tests**

Run: `bun test src/`
Expected: 22+ test files pass with 0 failures.

- [x] **Step 2: Run live OCR test**

Run: `npm run test:ocr-live`
Expected: Real receipt sample scans in < 4 seconds with category and account inferred.

- [x] **Step 3: Run Playwright E2E suite**

Run: `npm run test:e2e`
Expected: All 13 existing browser tests pass cleanly.

- [x] **Step 4: Commit any final regression adjustments**

```bash
git add .
git commit -m "test: verify all unit, live ocr, and e2e suites pass"
```
