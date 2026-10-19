# Live Currency Formatter and Midnight Obsidian Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide zero-lag real-time IDR currency formatting with smart cursor tracking in transaction inputs, and elevate dark mode with the sleek Midnight Obsidian theme.

**Architecture:** A pure helper `src/lib/currencyInputFormatter.ts` handles non-jumping cursor calculations and live token formatting (supporting pure numbers and inline math expressions). `TransactionFormSheet.tsx` uses `requestAnimationFrame` cursor synchronization. `src/styles/theme.css` and Gate 12 tests update dark mode tokens to Midnight Obsidian with WCAG AA compliance.

**Tech Stack:** React 19, TypeScript, Vite, CSS custom properties, Bun test, Vitest.

## Global Constraints

- Indonesian currency uses dot (`.`) as thousand separator and comma (`,`) as decimal separator.
- Never import `bun:test` in `src/lib/` or `src/features/` (to prevent `tsc -b` compilation failures). Use standard Node/plain `assert(cond, msg)`.
- Zero raw hex colors in `src/styles/components.css` (strictly enforced by Gate 12).
- All dark mode text on surface cards/base must achieve WCAG AA contrast ratio >= 4.5:1.
- All 14 E2E gates in `tests/e2e-gates.test.ts` must pass.
- All 30+ unit test suites in `bun test src/` must pass.

---

### Task 1: Currency Input Formatter Pure Helper & Unit Tests

**Files:**
- Create: `src/lib/currencyInputFormatter.ts`
- Create: `src/lib/currencyInputFormatter.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface FormatLiveAmountResult {
    formatted: string;
    rawNumber: number | null;
    isExpression: boolean;
  }

  export function formatLiveAmount(input: string): FormatLiveAmountResult;
  export function calculateNewCursorPosition(oldText: string, newText: string, oldCursor: number): number;
  ```

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/currencyInputFormatter.test.ts`:
```typescript
import { formatLiveAmount, calculateNewCursorPosition } from './currencyInputFormatter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// 1. Basic pure digits formatting
{
  const r1 = formatLiveAmount('1000');
  assert(r1.formatted === '1.000', `Expected 1.000, got ${r1.formatted}`);
  assert(r1.rawNumber === 1000, `Expected 1000, got ${r1.rawNumber}`);
  assert(!r1.isExpression, 'Should not be expression');

  const r2 = formatLiveAmount('1000000');
  assert(r2.formatted === '1.000.000', `Expected 1.000.000, got ${r2.formatted}`);
  assert(r2.rawNumber === 1000000, `Expected 1000000, got ${r2.rawNumber}`);

  const r3 = formatLiveAmount('0050000');
  assert(r3.formatted === '50.000', `Expected 50.000, got ${r3.formatted}`);
  assert(r3.rawNumber === 50000, `Expected 50000, got ${r3.rawNumber}`);

  const rEmpty = formatLiveAmount('');
  assert(rEmpty.formatted === '', `Expected empty string, got ${rEmpty.formatted}`);
  assert(rEmpty.rawNumber === null, 'Expected null rawNumber');
}

// 2. Inline math expression formatting
{
  const rMath = formatLiveAmount('50000 + 25000');
  assert(rMath.formatted === '50.000 + 25.000', `Expected 50.000 + 25.000, got ${rMath.formatted}`);
  assert(rMath.isExpression === true, 'Should be expression');

  const rShorthand = formatLiveAmount('15k + 20rb');
  assert(rShorthand.formatted === '15k + 20rb', `Expected 15k + 20rb, got ${rShorthand.formatted}`);
  assert(rShorthand.isExpression === true, 'Should be expression');
}

// 3. Smart cursor position calculation
{
  // Appending at end: typing '0' at end of '100' -> '1.000'
  const oldText1 = '1000';
  const newText1 = '1.000';
  const cursor1 = calculateNewCursorPosition(oldText1, newText1, 4);
  assert(cursor1 === 5, `Expected cursor at 5, got ${cursor1}`);

  // Typing in the middle: '10.000' cursor at 2 (after '10'), user types '5' -> '105000' -> '105.000'
  const oldText2 = '105.000';
  const newText2 = '105.000';
  const cursor2 = calculateNewCursorPosition('105000', newText2, 3);
  assert(cursor2 === 3, `Expected cursor at 3, got ${cursor2}`);

  // Backspacing a dot: in '1.000', user at index 2 backspaces dot -> '1000' -> '1.000'
  const cursor3 = calculateNewCursorPosition('1000', '1.000', 1);
  assert(cursor3 === 1, `Expected cursor at 1, got ${cursor3}`);
}

console.log('currencyInputFormatter tests pass');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/currencyInputFormatter.test.ts`
Expected: FAIL with module `./currencyInputFormatter` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/currencyInputFormatter.ts`:
```typescript
/**
 * Real-time IDR currency input formatter with smart cursor tracking.
 */

export interface FormatLiveAmountResult {
  formatted: string;
  rawNumber: number | null;
  isExpression: boolean;
}

const MATH_OPERATORS = /[+\-*/]/;
const SHORTHAND_UNITS = /[kK]|rb|RB|Rb|rB/;

/**
 * Format raw numbers with dot thousand separator.
 */
function formatIntegerString(digits: string): string {
  const trimmed = digits.replace(/^0+(?=\d)/, '');
  if (!trimmed) return '';
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formats user input in real-time.
 * - Handles pure numbers: '1000000' -> '1.000.000'
 * - Handles math expressions: '50000 + 25000' -> '50.000 + 25.000'
 * - Preserves shorthand: '15k', '20rb'
 */
export function formatLiveAmount(input: string): FormatLiveAmountResult {
  if (!input) {
    return { formatted: '', rawNumber: null, isExpression: false };
  }

  // Check if it's an expression or has shorthand units
  const hasOperator = MATH_OPERATORS.test(input);
  const hasShorthand = SHORTHAND_UNITS.test(input);

  if (hasOperator || hasShorthand) {
    // Format numeric chunks within expression while preserving operators, units, and spaces
    const formatted = input.replace(/\d+/g, (match) => {
      return formatIntegerString(match);
    });

    return {
      formatted,
      rawNumber: null,
      isExpression: true,
    };
  }

  // Pure numeric input: strip any existing dots or spaces
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) {
    return { formatted: '', rawNumber: null, isExpression: false };
  }

  const formatted = formatIntegerString(digitsOnly);
  const rawNumber = parseInt(digitsOnly, 10);

  return {
    formatted,
    rawNumber: Number.isNaN(rawNumber) ? null : rawNumber,
    isExpression: false,
  };
}

/**
 * Computes the new cursor position after formatting so that the cursor stays
 * at the same logical position relative to non-separator characters.
 */
export function calculateNewCursorPosition(
  oldText: string,
  newText: string,
  oldCursor: number
): number {
  // Count non-separator characters (digits, operators, letters) to the left of oldCursor
  let nonSepCount = 0;
  for (let i = 0; i < oldCursor && i < oldText.length; i++) {
    if (oldText[i] !== '.') {
      nonSepCount++;
    }
  }

  // Traverse newText until we find the exact same number of non-separator characters
  let newCursor = 0;
  let seenNonSep = 0;
  while (newCursor < newText.length && seenNonSep < nonSepCount) {
    if (newText[newCursor] !== '.') {
      seenNonSep++;
    }
    newCursor++;
  }

  return newCursor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/currencyInputFormatter.test.ts`
Expected: PASS with "currencyInputFormatter tests pass".

- [ ] **Step 5: Commit**

```bash
git add src/lib/currencyInputFormatter.ts src/lib/currencyInputFormatter.test.ts
git commit -m "feat(formatter): add real-time currency formatter and smart cursor calculation"
```

---

### Task 2: Integrate Live Formatting into `TransactionFormSheet.tsx`

**Files:**
- Modify: `src/features/transactions/TransactionFormSheet.tsx:186-228`
- Modify: `src/features/transactions/TransactionFormSheet.tsx:755-775`

**Interfaces:**
- Consumes: `formatLiveAmount`, `calculateNewCursorPosition` from `../../lib/currencyInputFormatter`

- [ ] **Step 1: Wire `amountInputRef` and update `handleAmountChange`**

In `src/features/transactions/TransactionFormSheet.tsx`:
1. Import `formatLiveAmount, calculateNewCursorPosition` from `../../lib/currencyInputFormatter`.
2. Add `const amountInputRef = useRef<HTMLInputElement>(null);`.
3. In `handleAmountChange(val: string)`:
   - Capture current cursor from `amountInputRef.current?.selectionStart ?? val.length`.
   - Compute `formatLiveAmount(val)`.
   - Compute `calculateNewCursorPosition(val, result.formatted, currentCursor)`.
   - Update `setAmountInput(result.formatted)`.
   - If not expression and `result.rawNumber !== null`: `setRawAmount(String(result.rawNumber))`.
   - Sync cursor via `requestAnimationFrame(() => amountInputRef.current?.setSelectionRange(newCursor, newCursor))`.
4. In `handleAmountFocus()`:
   - Keep the formatted dots so input doesn't jump. Remove the stripping code:
     `if (!mathError && !amountInput && rawAmount) { setAmountInput(new Intl.NumberFormat('id-ID').format(Number(rawAmount))); }`.
5. Attach `ref={amountInputRef}` to `<input className="input-hero-amount" ... />`.

- [ ] **Step 2: Run transaction tests to ensure zero regressions**

Run: `bun test src/features/transactions/`
Expected: All 6 transaction test suites pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/transactions/TransactionFormSheet.tsx
git commit -m "feat(ui): integrate real-time nominal formatting with smart cursor tracking"
```

---

### Task 3: Midnight Obsidian Dark Mode Tokens & Gate 12 Contrast Audit

**Files:**
- Modify: `src/styles/theme.css:142-251`
- Modify: `tests/e2e-gates.test.ts:688-750`

**Interfaces:**
- CSS tokens in `:root[data-theme='dark']` and `@media (prefers-color-scheme: dark)`:
  - `--surface-base: #09090b`
  - `--surface-card: #141417`
  - `--surface-secondary: #1c1c21`
  - `--border-subtle: rgba(255, 255, 255, 0.08)`
  - `--border: rgba(255, 255, 255, 0.12)`
  - `--text-primary: #f4f4f5`
  - `--text-muted: #a1a1aa`
  - `--accent-primary: #6366f1`
  - `--accent-primary-hover: #4f46e5`
  - `--success: #10b981`
  - `--warning: #f59e0b`
  - `--error: #f43f5e`
  - `--info: #38bdf8`

- [ ] **Step 1: Update dark mode tokens in `src/styles/theme.css`**

Replace `:root[data-theme='dark']` and `@media (prefers-color-scheme: dark)` blocks in `src/styles/theme.css` with the Midnight Obsidian tokens:
- Delicate 8% / 12% borders instead of harsh 35% chalky borders.
- Pure obsidian black surfaces (`#09090b`) and elevated slate-charcoal cards (`#141417`).
- Electric indigo accent (`#6366f1`).
- Clean emerald mint (`#10b981`), amber gold (`#f59e0b`), coral rose (`#f43f5e`), and cyan sky (`#38bdf8`).

- [ ] **Step 2: Update Gate 12 in `tests/e2e-gates.test.ts` to audit the new Midnight Obsidian tokens**

Update the dark audit pairs in Gate 12 to reflect the new theme values and verify all contrast ratios >= 4.5:1.

- [ ] **Step 3: Run Gate 12 and full E2E gates test**

Run: `npm run test:e2e`
Expected: All 14 gates pass.

- [ ] **Step 4: Commit**

```bash
git add src/styles/theme.css tests/e2e-gates.test.ts
git commit -m "style(theme): upgrade dark mode to Midnight Obsidian with WCAG AA compliance"
```

---

### Task 4: Full Verification, Production Build & Live Deployment

**Files:**
- Verify: all test suites
- Build: `npm run build`
- Deploy: `firebase deploy --only hosting`

- [ ] **Step 1: Run zero raw hex audit**

Run: `grep -iE '#[0-9a-fA-F]{3,8}' src/styles/components.css | wc -l`
Expected: `0`

- [ ] **Step 2: Run all unit tests**

Run: `bun test src/`
Expected: 30 test suites pass.

- [ ] **Step 3: Run all 14 E2E gates**

Run: `npm run test:e2e`
Expected: 14 passing gates.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: Clean build (`tsc -b && vite build`) without warnings or errors.

- [ ] **Step 5: Deploy to Firebase Hosting**

Run: `npx firebase-tools deploy --only hosting`
Expected: Live deployment complete at `https://catat-8897d.web.app`.
