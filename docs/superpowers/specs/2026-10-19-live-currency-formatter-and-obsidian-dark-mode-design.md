# Design Specification: Live Currency Input Formatter & Midnight Obsidian Dark Mode

**Date:** 2026-10-19  
**Status:** Validated & Approved  
**Author:** Pair Programming (Google DeepMind Antigravity + User)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Nominal Input Usability Issues
1. **Unformatted while typing:** Users previously saw raw unformatted digits (e.g. `1000000`) while typing. Formatting with Indonesian thousand separators (`.`) only applied when leaving the input field (`onBlur`), making it difficult to verify large amounts (e.g. counting zeroes between 100k, 1M, and 10M).
2. **Focus unformatting:** Clicking back into a formatted number stripped the dots (e.g. `1.000.000` became `1000000`), creating a jarring visual jump.
3. **The "Fast Typing & Cursor Jumping" risk:** Naive implementations of live formatting suffer from cursor jumping to the end of the text on every keystroke, dropped keystrokes during rapid bursts, and syntax breakage on inline math expressions (e.g. `50.000 + 25.000` or `15k`).

### 1.2 The Dark Mode Aesthetic Issues
1. **Harsh Chalky Borders:** The dark theme previously defined `--border: rgba(255, 255, 255, 0.35)`. A 35% white opacity border is excessively bright and harsh in dark mode, causing eye strain and a boxy, unpolished appearance.
2. **Dull/Muddy Palette:** Generic slate surfaces (`#0b0f19` and `#111827`) felt cold and lacked the depth and sophistication of premium modern apps (e.g., Linear, Apple Pro, Raycast).

---

## 2. Technical Architecture: Live Currency Input Formatter

### 2.1 Pure Helper: `src/lib/currencyInputFormatter.ts`
The formatter consists of two pure, independently testable functions:

#### Function 1: `formatLiveAmount(input: string): { formatted: string; rawNumber: number | null; isExpression: boolean }`
- **Math Expression Detection:** If the string contains math operators (`+`, `-`, `*`, `/`) or shorthand multipliers (`k`, `rb`), it is treated as an expression.
  - Number tokens inside expressions are individually formatted with thousand separators (e.g. `50000 + 25000` -> `50.000 + 25.000`).
  - Operators and spaces are preserved verbatim so user flow is uninterrupted.
- **Pure Numeric Input:**
  - Strips any non-digit characters.
  - Formats with IDR thousand separator (`.`).
  - Leading zeroes (except for `0` itself) are trimmed.
  - E.g. `0050000` -> `50.000`.

#### Function 2: `calculateNewCursorPosition(oldText: string, newText: string, oldCursor: number): number`
- **Smart Digit Counting Algorithm:**
  1. Counts the number of non-separator characters (digits and operators) strictly to the left of `oldCursor` in `oldText`.
  2. Traverses `newText` from left to right until the exact same count of non-separator characters has been encountered.
  3. Returns the new index.
- **Guarantee:**
  - Fast typing appends numbers cleanly.
  - Editing in the middle of a number (e.g. inserting or deleting a digit) keeps the cursor directly after the edited digit without jumping to the end.
  - Backspacing a thousand separator cleanly removes the preceding digit.

### 2.2 Integration in `TransactionFormSheet.tsx`
- Refactor the amount input to use `amountInputRef: React.RefObject<HTMLInputElement>`.
- In `handleAmountChange(val: string)`:
  - Capture current cursor: `const cursor = inputRef.current?.selectionStart ?? val.length;`
  - Compute `formatted = formatLiveAmount(val);`
  - Compute `newCursor = calculateNewCursorPosition(val, formatted.formatted, cursor);`
  - Update `amountInput` state.
  - Restore cursor position via `requestAnimationFrame`: `inputRef.current?.setSelectionRange(newCursor, newCursor);`
- Retain thousand dots on focus (no jarring strip).
- Retain `handleAmountBlur` and `handleAmountKeyDown('Enter')` to evaluate any pending math expressions to a final single amount.

---

## 3. Dark Mode Palette: "Midnight Obsidian"

### 3.1 Color Tokens in `src/styles/theme.css`
Applied to `:root[data-theme='dark']` and `@media (prefers-color-scheme: dark)`:

```css
:root[data-theme='dark'] {
  color-scheme: dark;

  /* Surfaces (Midnight Obsidian) */
  --surface-base: #09090b;             /* Pure Obsidian Black */
  --surface-card: #141417;             /* Elevated Slate-Charcoal */
  --surface-secondary: #1c1c21;        /* Secondary Hover & Input Fill */
  --border-subtle: rgba(255, 255, 255, 0.08); /* Delicate 8% White Border */
  --border: rgba(255, 255, 255, 0.12);        /* Crisp 12% White Border */

  /* Text & Foreground */
  --text-primary: #f4f4f5;             /* Soft Crisp White (no glare) */
  --text-muted: #a1a1aa;               /* Silver Zinc (WCAG AA > 4.5:1) */
  --text-inverse: #09090b;

  /* Accents */
  --accent-primary: #6366f1;           /* Electric Indigo */
  --accent-primary-hover: #4f46e5;

  /* Semantic Financial Accents */
  --success: #10b981;                  /* Vibrant Emerald Mint */
  --success-light: rgba(16, 185, 129, 0.14);
  --success-fg: #6ee7b7;

  --warning: #f59e0b;                  /* Amber Gold */
  --warning-light: rgba(245, 158, 11, 0.14);
  --warning-fg: #fde68a;

  --error: #f43f5e;                    /* Coral Rose */
  --error-light: rgba(244, 63, 94, 0.14);
  --error-fg: #fca5a5;

  --info: #38bdf8;                     /* Cyan Sky */
  --info-light: rgba(56, 189, 248, 0.14);
  --info-fg: #7dd3fc;

  /* Shadows */
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.6);
  --shadow-md: 0 4px 12px -1px rgba(0, 0, 0, 0.7);
  --shadow-lg: 0 12px 24px -3px rgba(0, 0, 0, 0.8);
}
```

### 3.2 Visual Contrast & Quality Verification (Gate 12)
- All text on background/cards maintains a contrast ratio `>= 4.5:1` (WCAG AA).
- All UI borders and indicators maintain `>= 3:1`.
- Verified via `tests/e2e-gates.test.ts` (Gate 12).
- Zero raw hex colors in `src/styles/components.css`.

---

## 4. Verification & Testing Plan
1. **Unit Tests (`src/lib/currencyInputFormatter.test.ts`):**
   - Pure digits format: `1000` -> `1.000`, `1000000` -> `1.000.000`.
   - Cursor calculation during typing at end.
   - Cursor calculation during typing in the middle of a string.
   - Cursor calculation when backspacing through a separator.
   - Math expressions formatted per token: `50000+25000` -> `50.000+25.000`.
   - Suffixes supported: `15k` -> `15k`, `20rb` -> `20rb`.
2. **Quality Gates:**
   - `bun test src/` passes 100%.
   - `npm run test:e2e` passes all 14 gates.
   - `npm run build` compiles with zero TypeScript errors.
   - Live deployment on Firebase Hosting.
