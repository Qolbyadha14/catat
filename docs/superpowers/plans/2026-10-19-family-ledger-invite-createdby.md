# Family Ledger (Buku Kas Bersama), WhatsApp Invite, "Created By" & Itemized Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build collaborative family ledger functionality ("Buku Kas Bersama") in Catat with frictionless WhatsApp invite links/codes, creator attribution (`createdBy`) on transactions, receipt reference keys (`platform#transactionNumber`) for anti-duplicate protection, and itemized product list extraction (`items`).

**Architecture:** Extend Firestore with `/ledgers/{ledgerId}` multi-tenant workspaces where members collaborate equally on accounts, categories, and transactions, while preserving 100% backward compatibility for single-user ledgers (`ledgerId = uid`). Upgrade `transactionSchema` and `ocrReceiptSchema` to support `createdBy`, `referenceKey`, and `items: TransactionItem[]`. Provide a clean UI for family management, WhatsApp sharing, join confirmation, and itemized product inspection in the review card and dashboard.

**Tech Stack:** React 19, TypeScript, Zod, Cloud Firestore, Firebase Auth, Google Gemini API (Multimodal), CSS Variables (Tokens, WCAG AA, 0 raw hex).

## Global Constraints

- **WCAG AA Contrast:** >= 4.5:1 for normal text, >= 3:1 for UI components.
- **Gate 12 CSS Token Compliance:** Zero raw hex colors in `src/styles/components.css`. Use `var(--...)` tokens only.
- **Minimum Touch Targets:** Minimum 44px height/min-height for interactive elements.
- **Backward Compatibility:** All existing single-user collections (`/users/{uid}`) and 13 E2E quality gates must continue passing without breaking changes.
- **Zero Auto-Save:** AI OCR results must strictly remain in draft review until user explicitly confirms saving.

---

### Task 1: Domain Schemas (`schemas.ts`)

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/schemas.test.ts`

**Interfaces:**
- Produces: `TransactionCreator`, `TransactionItem`, `LedgerMember`, `Ledger` schemas and types.

- [ ] **Step 1: Write failing unit test in `src/lib/schemas.test.ts`**

Add tests validating `creatorSchema`, `transactionItemSchema`, and extended `transactionSchema`:
```typescript
import {
  creatorSchema,
  transactionItemSchema,
  transactionSchema,
  ledgerMemberSchema,
  ledgerSchema,
} from './schemas';

// Test creatorSchema
const validCreator = { uid: 'u123', name: 'Sarah', photoURL: 'https://example.com/p.jpg' };
assert(creatorSchema.parse(validCreator).name === 'Sarah', 'validates creator');

// Test transactionItemSchema
const validItem = { name: 'Susu UHT 1L', qty: 2, price: 18500, subtotal: 37000 };
assert(transactionItemSchema.parse(validItem).subtotal === 37000, 'validates line item');

// Test transaction with referenceKey and createdBy
const txWithMeta = {
  id: 'tx_1',
  type: 'expense' as const,
  amount: 37000,
  date: Date.now(),
  accountId: 'acc_1',
  categoryId: 'cat_1',
  note: 'Belanja Mingguan',
  referenceKey: 'tiktok#578129381293812',
  items: [validItem],
  createdBy: validCreator,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
const parsedTx = transactionSchema.parse(txWithMeta);
assert(parsedTx.referenceKey === 'tiktok#578129381293812', 'parses referenceKey');
assert(parsedTx.items?.length === 1, 'parses items');
assert(parsedTx.createdBy?.name === 'Sarah', 'parses createdBy');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/schemas.test.ts`  
Expected: FAIL (`creatorSchema is not defined`).

- [ ] **Step 3: Update `src/lib/schemas.ts` with domain schemas**

Add `creatorSchema`, `transactionItemSchema`, `ledgerMemberSchema`, `ledgerSchema`, and extend `baseTx` with `referenceKey`, `items`, and `createdBy`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/schemas.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat(schema): add creator, line items, and ledger schemas"
```

---

### Task 2: OCR Schema & Gemini Line Items Extraction (`ocr/schema.ts`, `geminiService.ts`)

**Files:**
- Modify: `src/lib/ocr/schema.ts`
- Modify: `src/lib/ocr/geminiService.ts`
- Modify: `src/lib/ocr/ocr.test.ts`

**Interfaces:**
- Consumes: `TransactionItem` from `src/lib/schemas.ts`
- Produces: `OcrReceiptResult.transactionNumber`, `OcrReceiptResult.referenceKey`, `OcrReceiptResult.items`

- [ ] **Step 1: Write failing test in `src/lib/ocr/ocr.test.ts`**

Add assertion verifying that `parseOcrReceipt` parses `transactionNumber`, computes `referenceKey`, and validates `items`:
```typescript
const parsed = parseOcrReceipt({
  amount: 45000,
  date: '2026-10-19',
  merchant: 'TikTok Shop',
  confidence: 'high',
  platform: 'tiktok',
  transactionNumber: '578129381293812',
  items: [{ name: 'Kemeja Flannel', qty: 1, price: 45000, subtotal: 45000 }],
});
assert(parsed.transactionNumber === '578129381293812', 'extracts transactionNumber');
assert(parsed.referenceKey === 'tiktok#578129381293812', 'computes referenceKey');
assert(parsed.items.length === 1 && parsed.items[0].name === 'Kemeja Flannel', 'extracts items');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/ocr/ocr.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Update `src/lib/ocr/schema.ts` and `src/lib/ocr/geminiService.ts`**

1. In `schema.ts`:
   - Add `transactionNumber` (nullable string) and `items` (array of `transactionItemSchema`) to `ocrReceiptSchema`.
   - In `parseOcrReceipt`: Compute `referenceKey`:
     `const referenceKey = parsed.transactionNumber ? `${parsed.platform ?? 'other'}#${parsed.transactionNumber}` : null;`
   - Include `transactionNumber`, `referenceKey`, and `items` in returned `OcrReceiptResult`.
2. In `geminiService.ts`:
   - Update prompt schema description to instruct Gemini to extract:
     `"transactionNumber": nomor pesanan / nomor referensi transaksi struk (misal '578129381293812' pada TikTok Shop, '231019ABCD123' pada Shopee, atau kode ref bank), atau null`
     `"items": daftar barang/produk yang dibeli [{ "name": string, "qty": number, "price": number, "subtotal": number }], atau []`

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/ocr/ocr.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/ocr/schema.ts src/lib/ocr/geminiService.ts src/lib/ocr/ocr.test.ts
git commit -m "feat(ocr): add transactionNumber, referenceKey, and items extraction"
```

---

### Task 3: Ledger Service & Invite Code Utility (`ledgerService.ts`)

**Files:**
- Create: `src/lib/ledgerService.ts`
- Create: `src/lib/ledgerService.test.ts`

**Interfaces:**
- Produces:
  - `generateInviteCode(length?: number): string`
  - `formatWhatsAppInviteText(ledgerName: string, inviteCode: string, origin: string): string`
  - `createInitialLedger(owner: { uid: string; displayName?: string; email?: string; photoURL?: string }, name?: string): Ledger`
  - `addMemberToLedger(ledger: Ledger, member: LedgerMember): Ledger`
  - `findDuplicateReceipt(transactions: Transaction[], referenceKey: string | null): Transaction | null`

- [ ] **Step 1: Write test in `src/lib/ledgerService.test.ts`**

```typescript
import {
  generateInviteCode,
  formatWhatsAppInviteText,
  createInitialLedger,
  addMemberToLedger,
  findDuplicateReceipt,
} from './ledgerService';

// Test 1: generateInviteCode
const code1 = generateInviteCode();
assert(code1.length === 6, 'generates 6-char code');
assert(/^[A-Z0-9]+$/.test(code1), 'alphanumeric uppercase');

// Test 2: formatWhatsAppInviteText
const msg = formatWhatsAppInviteText('Keluarga Qolby', code1, 'https://catat-8897d.web.app');
assert(msg.includes('Keluarga Qolby'), 'includes ledger name');
assert(msg.includes(code1), 'includes invite code');
assert(msg.includes('https://catat-8897d.web.app/join?code='), 'includes join link');

// Test 3: createInitialLedger & addMemberToLedger
const ledger = createInitialLedger({ uid: 'u1', displayName: 'Qolby', email: 'q@test.com' }, 'Keluarga Qolby');
assert(ledger.ownerUid === 'u1', 'sets owner');
assert(ledger.members['u1'].role === 'owner', 'sets owner role');

const updated = addMemberToLedger(ledger, {
  uid: 'u2',
  name: 'Sarah',
  email: 's@test.com',
  role: 'member',
  joinedAt: Date.now(),
});
assert(updated.members['u2'].name === 'Sarah', 'adds member');

// Test 4: findDuplicateReceipt
const existingTx: any = { id: 'tx_1', referenceKey: 'tiktok#123', amount: 10000, date: 1000 };
assert(findDuplicateReceipt([existingTx], 'tiktok#123')?.id === 'tx_1', 'finds duplicate');
assert(findDuplicateReceipt([existingTx], 'tiktok#456') === null, 'returns null when not found');
assert(findDuplicateReceipt([existingTx], null) === null, 'returns null for null ref');

console.log('ledgerService tests pass');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/ledgerService.test.ts`  
Expected: FAIL (`module not found`).

- [ ] **Step 3: Implement `src/lib/ledgerService.ts`**

Implement helper functions using crypto random / alphanumeric generator, message template, and duplicate finder.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/ledgerService.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/ledgerService.ts src/lib/ledgerService.test.ts
git commit -m "feat(ledger): add ledgerService with invite code generation and duplicate finder"
```

---

### Task 4: Firestore Security Rules & E2E Collaborative Gates (`firestore.rules`, `tests/e2e-gates.test.ts`)

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/e2e-gates.test.ts`

**Interfaces:**
- Consumes: `/ledgers/{ledgerId}` rules definition
- Verifies: All existing 13 gates pass + new Gate for collaborative ledger multi-tenancy.

- [ ] **Step 1: Update `firestore.rules`**

Add rule definitions for `/ledgers/{ledgerId}` and its subcollections (`accounts`, `categories`, `transactions`), allowing members to collaborate equally. Keep `/users/{uid}` rules fully active for backward compatibility.

- [ ] **Step 2: Add collaborative test case in `tests/e2e-gates.test.ts`**

Add test verifying:
1. User A creates ledger.
2. User B joins ledger via membership.
3. User B creates transaction in ledger with `createdBy: { uid: User B, name: 'Sarah' }`.
4. User A reads transaction and balance updates atomically.

- [ ] **Step 3: Run E2E test suite**

Run: `npm run test:e2e`  
Expected: All tests pass.

- [ ] **Step 4: Commit changes**

```bash
git add firestore.rules tests/e2e-gates.test.ts
git commit -m "feat(security): update firestore.rules for collaborative family ledgers"
```

---

### Task 5: Transaction Service Wiring with `createdBy`, `referenceKey`, and `items` (`transactionService.ts`)

**Files:**
- Modify: `src/features/transactions/transactionService.ts`
- Modify: `src/features/transactions/transactionService.test.ts`

**Interfaces:**
- Consumes: `TransactionCreator`, `TransactionItem` from `src/lib/schemas.ts`
- Produces: `createTransaction`, `createBatchTransactions` with metadata persistence.

- [ ] **Step 1: Write failing unit test in `src/features/transactions/transactionService.test.ts`**

Verify that `createTransaction` and `createBatchTransactions` persist `createdBy`, `referenceKey`, and `items`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/transactions/transactionService.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Update `src/features/transactions/transactionService.ts`**

1. Update `CreateTransactionInput` to accept:
   - `createdBy?: TransactionCreator`
   - `referenceKey?: string | null`
   - `items?: TransactionItem[]`
   - `targetLedgerId?: string` (defaults to `uid`)
2. Persist these fields in Firestore doc creation.
3. Support target path `/ledgers/${ledgerId}/transactions` when `targetLedgerId` is provided.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/transactions/transactionService.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/features/transactions/transactionService.ts src/features/transactions/transactionService.test.ts
git commit -m "feat(transactions): support createdBy, referenceKey, and items in transactionService"
```

---

### Task 6: Review Card with Items & Anti-Duplicate Warning (`OcrReviewCard.tsx`, `components.css`)

**Files:**
- Modify: `src/features/transactions/OcrReviewCard.tsx`
- Modify: `src/features/transactions/OcrReviewCard.test.ts`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `OcrReceiptResult.items`, `OcrReceiptResult.referenceKey`, `existingTransactions: Transaction[]`
- Produces: Collapsible product list (`🛒 Rincian Barang`), reference badge (`🔖 tiktok#...`), and duplicate warning banner.

- [ ] **Step 1: Write test in `src/features/transactions/OcrReviewCard.test.ts`**

Add tests for formatting reference key chips and line items count label.

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/features/transactions/OcrReviewCard.test.ts`

- [ ] **Step 3: Update `OcrReviewCard.tsx` and `components.css`**

1. In `OcrReviewCard.tsx`:
   - Accept optional `duplicateTx?: Transaction | null`.
   - If `duplicateTx` is present, display:
     `⚠️ Struk ini kemungkinan sudah dicatat sebelumnya pada [Tanggal] [oleh Pembuat]`
   - If `result.referenceKey` exists, display subtle reference tag: `🔖 ${result.referenceKey}`.
   - If `result.items && result.items.length > 0`, render collapsible section:
     `🛒 Rincian Barang (${result.items.length} item)`:
     Display each item with `name`, `qty`, `price`, `subtotal`.
2. In `src/styles/components.css`:
   - Style `.ocr-items-collapse`, `.ocr-item-row`, `.ocr-duplicate-warning`, `.ocr-ref-badge`.
   - Ensure ZERO raw hex (Gate 12 compliant), WCAG AA contrast, and minimum 44px touch targets.

- [ ] **Step 4: Run unit tests and E2E contrast audit**

Run: `bun test src/ && npm run test:e2e`  
Expected: All pass including Gate 12.

- [ ] **Step 5: Commit changes**

```bash
git add src/features/transactions/OcrReviewCard.tsx src/features/transactions/OcrReviewCard.test.ts src/styles/components.css
git commit -m "feat(ui): add itemized products display and duplicate warning to OcrReviewCard"
```

---

### Task 7: Family Ledger Management Modal & WhatsApp Share UI (`FamilyLedgerSheet.tsx`, `DashboardView.tsx`)

**Files:**
- Create: `src/features/family/FamilyLedgerSheet.tsx`
- Create: `src/features/family/JoinLedgerDialog.tsx`
- Modify: `src/features/dashboard/DashboardView.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `ledgerService.ts`, `auth`, `activeLedger`
- Produces: Header family trigger button, WhatsApp share sheet, join dialog, and creator attribution in transaction history.

- [ ] **Step 1: Implement `FamilyLedgerSheet.tsx`**

- Displays current ledger name ("Keluarga ...").
- Lists active members with initials/avatars and roles.
- Displays 6-character invite code.
- Button **[📱 Bagikan Undangan WhatsApp]**:
  - Uses `navigator.share` (if available on mobile) or copies WhatsApp text with invite link to clipboard.
- Toast feedback: *"Link undangan disalin ke clipboard!"*.

- [ ] **Step 2: Implement `JoinLedgerDialog.tsx`**

- Checks `window.location.search` for `?code=XYZ` on mount or when user clicks "Gabung Buku Kas".
- Fetches ledger preview with matching invite code.
- Displays confirmation dialog with ledger name and owner name.
- On confirm: adds user to ledger members and switches `activeLedgerId`.

- [ ] **Step 3: Update `DashboardView.tsx`**

1. Add `👥 Buku Kas Keluarga` button in header.
2. Render creator badge in transaction history items:
   Beside date: `📅 19 Okt 2026 • 👤 Sarah`.
   If itemized products exist, display subtle badge `🛒 3 item`.
3. In `TransactionFormSheet` and `ReceiptScanTab`: pass logged-in user profile as `createdBy`.
4. Check for duplicate receipt in `ReceiptScanTab` using `findDuplicateReceipt`.

- [ ] **Step 4: Update `components.css` with clean, accessible tokens**

Style the family sheet, member avatars, creator badge, and join dialog. Verify zero raw hex.

- [ ] **Step 5: Run tests**

Run: `bun test src/ && npm run test:e2e`  
Expected: All pass.

- [ ] **Step 6: Commit changes**

```bash
git add src/features/family/FamilyLedgerSheet.tsx src/features/family/JoinLedgerDialog.tsx src/features/dashboard/DashboardView.tsx src/styles/components.css
git commit -m "feat(family): implement FamilyLedgerSheet, WhatsApp share, join dialog, and creator badge"
```

---

### Task 8: Full Verification, Production Build & Deployment

**Files:**
- All workspace files

- [ ] **Step 1: Run complete test suite**

Run: `bun test src/`  
Expected: All 26+ test files pass.

- [ ] **Step 2: Run all 13 E2E Quality Gates**

Run: `npm run test:e2e`  
Expected: 13 pass, 0 fail.

- [ ] **Step 3: Run production build**

Run: `npm run build`  
Expected: Zero TypeScript or Vite bundling errors.

- [ ] **Step 4: Deploy to Firebase Hosting**

Run: `npx -y firebase-tools@latest deploy --only hosting`  
Expected: Deploy complete to `https://catat-8897d.web.app`.
