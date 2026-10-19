# Smart Budgeting (Batas Anggaran Kategori & Kuota Harian Aman) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Smart Budgeting in Catat, allowing users to define monthly spending budgets per expense category, view dynamic progress bars with safe daily pace calculations, and receive overbudget warnings during transaction recording.

**Architecture:**
1. **Domain Logic (`src/lib/budgeting.ts`)**: Pure math and date utility module that computes budget usage, percentage, remaining balance, days remaining in the active month, and safe daily pace (`remaining / daysLeft`), as well as instant transaction impact evaluation.
2. **Schema & Persistence (`src/lib/schemas.ts`, `src/features/categories/categoryService.ts`)**: Extends `categorySchema` with optional `monthlyBudget?: number` (integer Rupiah). Fully backward-compatible with existing categories and Firestore security rules.
3. **Category Management (`src/features/manage/ManageSheet.tsx`)**: Adds a formatted budget input for expense categories and displays target badges (`🎯 Rp X/bln`) in the category list.
4. **Dashboard Visualization (`src/features/dashboard/CategoryBreakdown.tsx`)**: Upgrades the category breakdown cards to render multi-state budget progress bars (Emerald `<75%`, Amber `75–99%`, Coral `>=100%`) with daily pace indicators.
5. **Form Real-Time Hint (`src/features/transactions/TransactionFormSheet.tsx`)**: Shows a non-intrusive warning chip when recording an expense that exceeds the category's remaining monthly budget.

**Tech Stack:** React 19, TypeScript, Firestore, Bun Test, Vanilla CSS Design System.

## Global Constraints
- Zero raw hex codes in `src/styles/components.css` (enforced by Gate 12).
- WCAG AA contrast compliance: text >= 4.5:1, graphical UI >= 3:1 in both light and dark modes.
- Backward compatibility: If a category has no `monthlyBudget` (or 0), it must behave identically to the existing category breakdown.
- All 14 existing E2E quality gates (`npm run test:e2e`) and 32 unit tests must stay green.

---

### Task 1: Budgeting Domain Math & Pace Calculation Logic

**Files:**
- Create: `src/lib/budgeting.ts`
- Create: `src/lib/budgeting.test.ts`

**Interfaces:**
- Produces: `CategoryBudgetProgress`, `computeCategoryBudget`, `getDaysRemainingInMonth`, `evaluateTransactionBudgetImpact`

- [ ] **Step 1: Write failing unit tests for budgeting domain logic**
Create `src/lib/budgeting.test.ts` testing:
1. `getDaysRemainingInMonth`: Correct remaining days given a specific reference date (e.g., Oct 19 with 31 days in Oct -> 13 days remaining including today).
2. `computeCategoryBudget` with `<75%` spent -> status `'safe'`, calculates remaining and safe daily pace.
3. `computeCategoryBudget` with `80%` spent -> status `'warning'`.
4. `computeCategoryBudget` with `105%` spent -> status `'exceeded'`, remaining is 0, overbudget amount is 5%.
5. `evaluateTransactionBudgetImpact`: Correctly flags if an added expense exceeds remaining budget.

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test src/lib/budgeting.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/budgeting.ts`**
Implement the pure functions and interfaces:
```typescript
export interface CategoryBudgetProgress {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  spent: number;
  monthlyBudget: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
  daysRemainingInMonth: number;
  safeDailyPace: number;
  overbudgetAmount: number;
}

export function getDaysRemainingInMonth(refDate: Date = new Date()): number {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const currentDay = refDate.getDate();
  return Math.max(1, lastDay - currentDay + 1);
}

export function computeCategoryBudget(
  spent: number,
  monthlyBudget: number,
  refDate: Date = new Date()
): {
  spent: number;
  monthlyBudget: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
  daysRemainingInMonth: number;
  safeDailyPace: number;
  overbudgetAmount: number;
} {
  const safeSpent = Math.max(0, spent);
  const safeBudget = Math.max(0, monthlyBudget);
  const percentage = safeBudget > 0 ? Math.round((safeSpent / safeBudget) * 100) : 0;
  const remaining = Math.max(0, safeBudget - safeSpent);
  const overbudgetAmount = Math.max(0, safeSpent - safeBudget);
  const daysRemainingInMonth = getDaysRemainingInMonth(refDate);
  const safeDailyPace = remaining > 0 ? Math.floor(remaining / daysRemainingInMonth) : 0;

  let status: 'safe' | 'warning' | 'exceeded' = 'safe';
  if (percentage >= 100) {
    status = 'exceeded';
  } else if (percentage >= 75) {
    status = 'warning';
  }

  return {
    spent: safeSpent,
    monthlyBudget: safeBudget,
    remaining,
    percentage,
    status,
    daysRemainingInMonth,
    safeDailyPace,
    overbudgetAmount,
  };
}

export function evaluateTransactionBudgetImpact(
  monthlyBudget: number | undefined,
  currentSpent: number,
  newAmount: number
): { willExceed: boolean; remainingAfter: number; overbudgetAmount: number } {
  if (!monthlyBudget || monthlyBudget <= 0) {
    return { willExceed: false, remainingAfter: 0, overbudgetAmount: 0 };
  }
  const totalAfter = currentSpent + Math.max(0, newAmount);
  const willExceed = totalAfter > monthlyBudget;
  const remainingAfter = Math.max(0, monthlyBudget - totalAfter);
  const overbudgetAmount = Math.max(0, totalAfter - monthlyBudget);
  return { willExceed, remainingAfter, overbudgetAmount };
}
```

- [ ] **Step 4: Run unit tests**
Run: `bun test src/lib/budgeting.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 1**
```bash
git add src/lib/budgeting.ts src/lib/budgeting.test.ts
git commit -m "feat(budgeting): add budget domain logic and safe daily pace calculator"
```

---

### Task 2: Schema & Category Service Persistence for `monthlyBudget`

**Files:**
- Modify: `src/lib/schemas.ts:13-20`
- Modify: `src/features/categories/categoryService.ts:1-60`
- Modify: `src/features/accounts/accountService.test.ts`

**Interfaces:**
- Consumes: `categorySchema`
- Produces: `Category.monthlyBudget?: number`, `UpdateCategoryInput.monthlyBudget?: number | null`, `CreateCategoryInput.monthlyBudget?: number`

- [ ] **Step 1: Write test for category budget schema & sanitization**
Add tests to verify:
- `categorySchema` accepts and parses `monthlyBudget: 2500000`.
- `sanitizeCategoryUpdate` preserves valid positive integer budget, and rejects negative numbers or non-integers.

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test src/features/accounts/accountService.test.ts`
Expected: FAIL (monthlyBudget property not in schema / sanitization)

- [ ] **Step 3: Update `categorySchema` and `categoryService.ts`**
In `src/lib/schemas.ts`:
```typescript
export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(32),
  type: z.enum(['income', 'expense']),
  icon: z.string().max(8).optional(),
  monthlyBudget: z.number().int().nonnegative().optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int(),
});
```
In `src/features/categories/categoryService.ts`:
Update `UpdateCategoryInput`, `CreateCategoryInput`, and `sanitizeCategoryUpdate` to support `monthlyBudget`.

- [ ] **Step 4: Run unit tests**
Run: `bun test src/features/accounts/accountService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 2**
```bash
git add src/lib/schemas.ts src/features/categories/categoryService.ts src/features/accounts/accountService.test.ts
git commit -m "feat(categories): support monthlyBudget field in category schema and service"
```

---

### Task 3: ManageSheet Budget Input & Category Target Badge

**Files:**
- Modify: `src/features/manage/ManageSheet.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Produces: Form input `Target Anggaran Bulanan (Opsional)` when editing/creating expense categories.
- Produces: Target budget badge in category list (`🎯 Target: Rp 2.500.000/bln`).

- [ ] **Step 1: Update form state in `ManageSheet.tsx`**
Add:
- State `monthlyBudgetInput: string` (formatted with `.` thousands separators).
- Populate `monthlyBudgetInput` when clicking edit on a category: `cat.monthlyBudget ? new Intl.NumberFormat('id-ID').format(cat.monthlyBudget) : ''`.
- Save `monthlyBudget` on submit (clean dots, parse integer).
- Display budget pill in category row if `cat.monthlyBudget > 0`.

- [ ] **Step 2: Add styles in `src/styles/components.css`**
Add CSS for `.category-budget-badge` and `.form-budget-helper`:
- Uses semantic variables: `background: var(--surface-secondary); color: var(--text-muted); border: 1px solid var(--border-subtle);`
- ZERO raw hex codes!

- [ ] **Step 3: Run build and verify zero hex**
Run: `git grep -E "#[0-9a-fA-F]{3,8}\b" src/styles/components.css`
Expected: 0 matches
Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit Task 3**
```bash
git add src/features/manage/ManageSheet.tsx src/styles/components.css
git commit -m "feat(manage): add monthly budget input and list badge in ManageSheet"
```

---

### Task 4: Upgraded Dashboard Category Breakdown with Multi-State Progress Bars

**Files:**
- Modify: `src/lib/categoryBreakdown.ts`
- Modify: `src/lib/categoryBreakdown.test.ts`
- Modify: `src/features/dashboard/CategoryBreakdown.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `computeCategoryBudget` from `src/lib/budgeting.ts`
- Produces: Extended `CategoryBreakdownItem` with budget metadata (`monthlyBudget`, `status`, `remaining`, `safeDailyPace`).

- [ ] **Step 1: Write unit tests in `src/lib/categoryBreakdown.test.ts`**
Test that `computeCategoryBreakdown` includes budget metrics when category has `monthlyBudget`.

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test src/lib/categoryBreakdown.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `categoryBreakdown.ts` and `CategoryBreakdown.tsx`**
1. In `categoryBreakdown.ts`: Include `monthlyBudget` from category map and compute budget progress.
2. In `CategoryBreakdown.tsx`:
   - Render multi-state bar:
     - Class `.bar-safe` (emerald green) when `status === 'safe'`.
     - Class `.bar-warning` (amber gold) when `status === 'warning'`.
     - Class `.bar-exceeded` (coral rose) when `status === 'exceeded'`.
   - Show sub-caption: `Sisa Rp 500.000 • Aman Rp 35.000/hari` (or `⚠️ Overbudget Rp X`).
3. In `components.css`: Add styles for budget progress bars with zero hex.

- [ ] **Step 4: Run unit tests**
Run: `bun test src/lib/categoryBreakdown.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 4**
```bash
git add src/lib/categoryBreakdown.ts src/lib/categoryBreakdown.test.ts src/features/dashboard/CategoryBreakdown.tsx src/styles/components.css
git commit -m "feat(dashboard): show smart budget progress bars and safe daily pace in category breakdown"
```

---

### Task 5: Transaction Form Real-Time Overbudget Hint

**Files:**
- Modify: `src/features/transactions/TransactionFormSheet.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `evaluateTransactionBudgetImpact` from `src/lib/budgeting.ts`
- Displays: Dynamic contextual warning chip when selected category + input amount exceeds monthly budget.

- [ ] **Step 1: Wire real-time budget evaluation into `TransactionFormSheet.tsx`**
Compute:
```typescript
const budgetImpact = useMemo(() => {
  if (type !== 'expense' || !categoryId) return null;
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat || !cat.monthlyBudget) return null;
  const currentSpent = currentMonthCategorySpent.get(categoryId) || 0;
  const numAmount = parseInt(rawAmount, 10) || 0;
  return evaluateTransactionBudgetImpact(cat.monthlyBudget, currentSpent, numAmount);
}, [type, categoryId, categories, currentMonthCategorySpent, rawAmount]);
```
If `budgetImpact?.willExceed`:
Render banner: `⚠️ Transaksi ini akan melebihi anggaran bulanan kategori (Sisa saat ini: Rp X)`.

- [ ] **Step 2: Add styles in `src/styles/components.css`**
Add styles for `.form-budget-warning-pill` using `var(--warning-light)`, `var(--warning-fg)`.

- [ ] **Step 3: Commit Task 5**
```bash
git add src/features/transactions/TransactionFormSheet.tsx src/styles/components.css
git commit -m "feat(transactions): add real-time overbudget warning in transaction sheet"
```

---

### Task 6: Full Verification, E2E Gate Audit & Live Deployment

**Files:**
- All tests and production deployment.

- [ ] **Step 1: Zero Raw Hex & Lint Audit**
Run: `git grep -E "#[0-9a-fA-F]{3,8}\b" src/styles/components.css`
Expected: 0 matches

- [ ] **Step 2: Run all unit tests**
Run: `bun test src/`
Expected: All tests pass (33+ test suites)

- [ ] **Step 3: Run all 14 E2E gates**
Run: `npm run test:e2e`
Expected: 14 passed (163+ assertions)

- [ ] **Step 4: Build production bundle**
Run: `npm run build`
Expected: Clean build (`tsc -b && vite build`)

- [ ] **Step 5: Deploy to Firebase Hosting**
Run: `npx -y firebase-tools deploy --only hosting`
Expected: Live deployment complete to `https://catat-8897d.web.app`
