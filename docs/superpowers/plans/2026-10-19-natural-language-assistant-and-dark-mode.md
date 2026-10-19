# Natural Language Assistant & Midnight Deep Navy Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI Natural Language Transaction Assistant ("Mode Asisten Ketik") with Gemini + local offline fallback, and elevate Dark Mode to the "Midnight Deep Navy" aesthetic with verified WCAG AA contrast.

**Architecture:** 
1. The NLP parsing layer (`src/lib/nlp/textAssistantService.ts`) uses a dual-engine approach: `gemini-3.5-flash-lite` with structured JSON output for high accuracy, paired with an offline regex/heuristic engine for zero-network resilience.
2. The UI component (`src/features/transactions/TextAssistantTab.tsx`) replaces the static placeholder in `TransactionFormSheet.tsx`, rendering interactive suggestion chips, an auto-focused prompt box, and instant form pre-fill with parse feedback.
3. Dark Mode styling in `src/styles/theme.css` shifts to the rich "Midnight Deep Navy" palette (`#0b0f19` base, `#131926` cards, `#1c2438` secondary surfaces, hairline indigo borders), verified by Gate 12 contrast testing.

**Tech Stack:** React 19, TypeScript, Firebase AI Logic (`firebase/ai`), Vitest / Bun test, Vanilla CSS Design System.

## Global Constraints
- Zero raw hex codes in `src/styles/components.css` (enforced by Gate 12).
- WCAG AA contrast compliance: text >= 4.5:1, graphical UI >= 3:1.
- Offline resilience: If network or AI fails, the local regex parser must parse Indonesian monetary units (`rb`, `k`, `jt`, dot thousands) without throwing.
- All existing 14 E2E quality gates (`npm run test:e2e`) and 30 unit tests must stay green.

---

### Task 1: Midnight Deep Navy Color Palette Upgrade

**Files:**
- Modify: `src/styles/theme.css:140-270`
- Modify: `tests/e2e-gates.test.ts:680-760`

**Interfaces:**
- Produces: CSS custom properties (`--surface-base: #0b0f19`, `--surface-card: #131926`, `--surface-secondary: #1c2438`, `--border: rgba(99, 102, 241, 0.16)`, `--border-subtle: rgba(255, 255, 255, 0.08)`)

- [ ] **Step 1: Update CSS tokens in `src/styles/theme.css`**
Apply the Midnight Deep Navy palette to `:root[data-theme='dark']` and `:root:not([data-theme='light'])`:
- `--surface-base`: `#0b0f19`
- `--surface-card`: `#131926`
- `--surface-secondary`: `#1c2438`
- `--surface-hover`: `#243049`
- `--border-subtle`: `rgba(255, 255, 255, 0.08)`
- `--border`: `rgba(99, 102, 241, 0.16)`
- `--hero-bg`: `linear-gradient(145deg, #161e31 0%, #101524 50%, #0b0f19 100%)`
- `--hero-text-muted`: `#94a3b8`
- `--text-primary`: `#f8fafc`
- `--text-muted`: `#94a3b8`
- `--text-inverse`: `#ffffff`
- `--google-btn-bg`: `#1c2438`
- `--google-btn-fg`: `#f8fafc`

- [ ] **Step 2: Update contrast audit assertions in `tests/e2e-gates.test.ts`**
Update the background values tested in Gate 12 for dark mode to match `#131926`, `#0b0f19`, and `#1c2438`. Verify all contrast ratios exceed 4.5:1.

- [ ] **Step 3: Run E2E Gate 12 test**
Run: `npx vitest run tests/e2e-gates.test.ts -t "Gate 12"`
Expected: PASS

- [ ] **Step 4: Commit Task 1**
```bash
git add src/styles/theme.css tests/e2e-gates.test.ts
git commit -m "style(theme): upgrade dark mode to Midnight Deep Navy palette"
```

---

### Task 2: NLP Text Assistant Service & Dual-Engine Parser

**Files:**
- Create: `src/lib/nlp/textAssistantService.ts`
- Create: `src/lib/nlp/textAssistantService.test.ts`

**Interfaces:**
- Produces: `parseTransactionText(options: ParseTextOptions): Promise<ParsedTransactionResult>`
- Produces: `parseTransactionLocally(text: string, categories?: OcrCategoryContext[], accounts?: OcrAccountContext[]): ParsedTransactionResult`

- [ ] **Step 1: Write failing unit tests for NLP parsing**
Create `src/lib/nlp/textAssistantService.test.ts` testing:
1. `parseIndonesianAmount("Makan siang 35rb") -> 35000`
2. `parseIndonesianAmount("Gaji 8.5jt") -> 8500000`
3. `parseIndonesianAmount("Beli bensin 50k") -> 50000`
4. `parseIndonesianAmount("Transfer 100.000") -> 100000`
5. `parseTransactionLocally` matches type (`expense`, `income`, `transfer`), amount, account, and category.

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test src/lib/nlp/textAssistantService.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/nlp/textAssistantService.ts`**
Implement:
1. Helper `parseIndonesianAmount(text: string): number | null` (supports `rb`, `k`, `jt`, and dot formatted integers).
2. Helper `parseRelativeDate(text: string): string` (supports "kemarin", "hari ini", "tadi", "lusa").
3. Local regex matcher `parseTransactionLocally(text, categories, accounts)`.
4. Gemini AI model caller `parseTransactionWithGemini(text, categories, accounts)` using `firebase/ai` and `getGenerativeModel`.
5. Combined `parseTransactionText(text, options)`: tries Gemini first, falls back to `parseTransactionLocally` on error/timeout/offline.

- [ ] **Step 4: Run unit tests**
Run: `bun test src/lib/nlp/textAssistantService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 2**
```bash
git add src/lib/nlp/textAssistantService.ts src/lib/nlp/textAssistantService.test.ts
git commit -m "feat(nlp): add natural language transaction parser with Gemini AI and local fallback"
```

---

### Task 3: Text Assistant UI Component (`TextAssistantTab.tsx`)

**Files:**
- Create: `src/features/transactions/TextAssistantTab.tsx`
- Modify: `src/styles/components.css` (for text assistant styles, using 100% css variables)

**Interfaces:**
- Produces: `<TextAssistantTab categories={categories} accounts={accounts} onParsed={handleParsed} />`
- Consumes: `parseTransactionText` from `src/lib/nlp/textAssistantService.ts`

- [ ] **Step 1: Create `src/features/transactions/TextAssistantTab.tsx`**
Component features:
- Textarea input with placeholder: *"Contoh: Makan siang padang 35rb pake gopay"*
- Character counter & submit button with Send icon or "Proses Teks (AI)"
- Quick suggestion chips:
  - *"🍜 Makan siang 35rb Gopay"*
  - *"⛽ Beli bensin 50k Cash"*
  - *"☕ Kopi susu 25k SPayLater"*
  - *"💸 Transfer 200rb BCA ke Jago"*
  - *"💰 Gaji bulanan 8.5jt BCA"*
- Loading shimmer / spinner while parsing.
- Error banner if text cannot be parsed.

- [ ] **Step 2: Add styles in `src/styles/components.css`**
Add styles for `.text-assistant-container`, `.text-assistant-input`, `.text-assistant-chips`, `.text-assistant-chip`, `.text-assistant-btn-submit`, `.text-assistant-loading`.
Verify: ZERO raw hex codes (all `var(...)` or `rgba(...)`).

- [ ] **Step 3: Commit Task 3**
```bash
git add src/features/transactions/TextAssistantTab.tsx src/styles/components.css
git commit -m "feat(ui): add TextAssistantTab component with interactive suggestion chips"
```

---

### Task 4: Integrate `TextAssistantTab` into `TransactionFormSheet.tsx`

**Files:**
- Modify: `src/features/transactions/TransactionFormSheet.tsx`

**Interfaces:**
- Consumes: `<TextAssistantTab />`
- Passes parsed payload into existing form states (`setType`, `setAmount`, `setDescription`, `setCategoryId`, `setAccountId`, `setToAccountId`, `setDate`, `setItems`).

- [ ] **Step 1: Wire `TextAssistantTab` into `TransactionFormSheet.tsx`**
Replace the static placeholder banner at line 702-706 with `<TextAssistantTab ... />`.
When `onParsed(result)` fires:
- Fill `type` (`result.type`).
- Fill `amount` (`formatCurrencyInput(String(result.amount))`).
- Fill `description` (`result.description`).
- Fill `date` (`result.date`).
- Fill `categoryId` (`result.categoryId || ''`).
- Fill `accountId` (`result.accountId || accounts[0]?.id || ''`).
- Fill `toAccountId` (`result.toAccountId || ''`).
- If `result.items?.length > 0`, set items array.
- Switch `activeTab` to `'manual'` so user reviews the form immediately, with a banner: *"✓ Teks Berhasil Dipahami oleh AI"*.

- [ ] **Step 2: Verify zero raw hex & lint/build**
Run: `git grep -E "#[0-9a-fA-F]{3,8}" src/styles/components.css`
Expected: 0 matches
Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit Task 4**
```bash
git add src/features/transactions/TransactionFormSheet.tsx
git commit -m "feat(transactions): integrate text assistant into transaction form flow"
```

---

### Task 5: End-to-End Gates Verification & Production Deployment

**Files:**
- Tests & Production bundle

- [ ] **Step 1: Run all unit tests**
Run: `bun test src/`
Expected: All tests pass (30+ tests)

- [ ] **Step 2: Run all 14 E2E gates**
Run: `npm run test:e2e`
Expected: 14 passed (163+ assertions)

- [ ] **Step 3: Build production bundle**
Run: `npm run build`
Expected: Clean build (`tsc -b && vite build`)

- [ ] **Step 4: Deploy to Firebase Hosting**
Run: `npx -y firebase-tools deploy --only hosting`
Expected: Live deployment complete to `https://catat-8897d.web.app`
