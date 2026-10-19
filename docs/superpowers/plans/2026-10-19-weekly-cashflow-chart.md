# Weekly Cashflow Breakdown (Grafik Tren Arus Kas Mingguan) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an interactive weekly cashflow visualizer in the monthly dashboard, showing income vs expense comparisons across Weeks 1-5 with spending pace trend indicators, without third-party heavy charting libraries.

**Architecture:**
1. **Domain Logic (`src/lib/weeklyCashflow.ts`)**: Pure mathematical function that splits transactions of a given month into calendar weeks (Week 1: 1–7, Week 2: 8–14, Week 3: 15–21, Week 4: 22–28, Week 5: 29–end of month), aggregates income, expense, and net surplus/deficit, calculates percentage share, and identifies peak spending periods.
2. **Component (`src/features/dashboard/WeeklyCashflowChart.tsx`)**: Responsive, lightweight CSS-bar chart component with dual-bar columns (Income in Emerald, Expense in Rose/Coral), percentage heights, and touch/hover tooltip revealing exact amounts.
3. **Integration (`src/features/dashboard/DashboardView.tsx`)**: Placed conveniently beneath the Monthly Cashflow Hero Card or collapsible with an intuitive toggle.
4. **Design System & Zero Hex (`src/styles/components.css`)**: Built completely with existing semantic tokens (`--surface-card`, `--accent-primary`, `--success-fg`, `--danger-fg`, `--border-subtle`).

**Tech Stack:** React 19, TypeScript, Bun Test, Pure CSS Flexbox Bars.

## Global Constraints
- Zero raw hex codes in `src/styles/components.css` (enforced by Gate 12).
- WCAG AA contrast compliance: text >= 4.5:1, graphical UI >= 3:1 in both light and dark modes.
- Lightweight: No external chart bundle bloat (Chart.js / Recharts). 100% native DOM/CSS.
- All 14 existing E2E quality gates (`npm run test:e2e`) and 33 unit tests must stay green.

---

### Task 1: Weekly Grouping Math & Domain Logic

**Files:**
- Create: `src/lib/weeklyCashflow.ts`
- Create: `src/lib/weeklyCashflow.test.ts`

**Interfaces:**
- Produces: `computeWeeklyCashflow`, `WeeklyCashflowData`, `WeekSummary`

- [ ] **Step 1: Write failing unit tests for weekly cashflow calculations**

Create `src/lib/weeklyCashflow.test.ts`:
```typescript
import { computeWeeklyCashflow, type WeekSummary } from './weeklyCashflow';
import type { Transaction } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Year 2026, Month 10 (October, 31 days)
const year = 2026;
const month = 10;

const mockTransactions: Transaction[] = [
  // Week 1 (Oct 3)
  {
    id: 'tx-1',
    type: 'expense',
    amount: 150000,
    accountId: 'acc-1',
    categoryId: 'food',
    date: new Date(2026, 9, 3).getTime(),
    createdAt: Date.now(),
  },
  // Week 1 (Oct 5) - Income
  {
    id: 'tx-2',
    type: 'income',
    amount: 5000000,
    accountId: 'acc-1',
    categoryId: 'salary',
    date: new Date(2026, 9, 5).getTime(),
    createdAt: Date.now(),
  },
  // Week 2 (Oct 10) - Expense
  {
    id: 'tx-3',
    type: 'expense',
    amount: 300000,
    accountId: 'acc-1',
    categoryId: 'bill',
    date: new Date(2026, 9, 10).getTime(),
    createdAt: Date.now(),
  },
  // Week 4 (Oct 25) - Expense
  {
    id: 'tx-4',
    type: 'expense',
    amount: 450000,
    accountId: 'acc-1',
    categoryId: 'shopping',
    date: new Date(2026, 9, 25).getTime(),
    createdAt: Date.now(),
  },
];

const result = computeWeeklyCashflow(mockTransactions, year, month);

// 1. Should produce 5 weeks for October (31 days)
assert(result.weeks.length === 5, 'October should have 5 weeks');
assert(result.weeks[0].weekNumber === 1, 'First week is Week 1');
assert(result.weeks[0].dateRangeLabel === '1 - 7 Okt', 'Date range label matches');

// 2. Week 1 income and expense
assert(result.weeks[0].income === 5000000, 'Week 1 income should be 5.000.000');
assert(result.weeks[0].expense === 150000, 'Week 1 expense should be 150.000');
assert(result.weeks[0].net === 4850000, 'Week 1 net should be 4.850.000');

// 3. Week 2 expense
assert(result.weeks[1].expense === 300000, 'Week 2 expense should be 300.000');

// 4. Week 3 empty
assert(result.weeks[2].expense === 0, 'Week 3 expense should be 0');

// 5. Peak spending week
assert(result.peakExpenseWeekNumber === 4, 'Week 4 had highest expense (450.000)');

console.log('weeklyCashflow unit tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/weeklyCashflow.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/weeklyCashflow.ts`**

Create `src/lib/weeklyCashflow.ts`:
```typescript
import type { Transaction } from './schemas';

export interface WeekSummary {
  weekNumber: number;
  dateRangeLabel: string;
  startDay: number;
  endDay: number;
  income: number;
  expense: number;
  net: number;
  expenseRatio: number; // 0 to 1 relative to highest week
  incomeRatio: number;
}

export interface WeeklyCashflowData {
  weeks: WeekSummary[];
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  peakExpenseWeekNumber: number;
  maxWeeklyAmount: number;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export function computeWeeklyCashflow(
  transactions: Transaction[],
  year: number,
  month: number // 1 to 12
): WeeklyCashflowData {
  const monthIdx = month - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLabel = MONTH_NAMES_SHORT[monthIdx] || '';

  // Week boundaries: 1-7, 8-14, 15-21, 22-28, 29-end
  const weekRanges = [
    { start: 1, end: 7 },
    { start: 8, end: 14 },
    { start: 15, end: 21 },
    { start: 22, end: 28 },
    { start: 29, end: daysInMonth },
  ];

  const weeks: WeekSummary[] = weekRanges.map((r, idx) => ({
    weekNumber: idx + 1,
    dateRangeLabel: `${r.start} - ${r.end} ${monthLabel}`,
    startDay: r.start,
    endDay: r.end,
    income: 0,
    expense: 0,
    net: 0,
    expenseRatio: 0,
    incomeRatio: 0,
  }));

  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    if (txDate.getFullYear() !== year || txDate.getMonth() !== monthIdx) {
      continue;
    }

    const day = txDate.getDate();
    const weekIdx = Math.min(Math.floor((day - 1) / 7), 4);
    const targetWeek = weeks[weekIdx];

    if (tx.type === 'expense') {
      targetWeek.expense += tx.amount;
      totalExpense += tx.amount;
    } else if (tx.type === 'income') {
      targetWeek.income += tx.amount;
      totalIncome += tx.amount;
    }
  }

  let peakExpenseWeekNumber = 1;
  let maxExpense = 0;
  let maxWeeklyAmount = 0;

  for (const w of weeks) {
    w.net = w.income - w.expense;
    if (w.expense > maxExpense) {
      maxExpense = w.expense;
      peakExpenseWeekNumber = w.weekNumber;
    }
    const highestInWeek = Math.max(w.income, w.expense);
    if (highestInWeek > maxWeeklyAmount) {
      maxWeeklyAmount = highestInWeek;
    }
  }

  // Calculate normalized ratios for UI bar heights
  const divisor = maxWeeklyAmount > 0 ? maxWeeklyAmount : 1;
  for (const w of weeks) {
    w.expenseRatio = w.expense / divisor;
    w.incomeRatio = w.income / divisor;
  }

  return {
    weeks,
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    peakExpenseWeekNumber: maxExpense > 0 ? peakExpenseWeekNumber : 0,
    maxWeeklyAmount,
  };
}
```

- [ ] **Step 4: Run unit tests**

Run: `bun test src/lib/weeklyCashflow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/weeklyCashflow.ts src/lib/weeklyCashflow.test.ts
git commit -m "feat(cashflow): add weekly cashflow aggregation logic"
```

---

### Task 2: Responsive WeeklyCashflowChart Component

**Files:**
- Create: `src/features/dashboard/WeeklyCashflowChart.tsx`
- Modify: `src/features/dashboard/DashboardView.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `computeWeeklyCashflow` from `src/lib/weeklyCashflow`
- Props: `transactions: Transaction[]`, `year: number`, `month: number`

- [ ] **Step 1: Create `WeeklyCashflowChart.tsx`**
Renders:
- Header: *"Tren Mingguan"* + summary caption.
- Interactive Bar Columns (Week 1 to Week 5):
  - Dual bar track with Income bar (Emerald green) and Expense bar (Rose/Coral red).
  - Hover / focus tooltip showing exact formatted Rupiah (`formatIdr`).
  - Week labels (`W1`, `W2`, `W3`, `W4`, `W5`).
- Legend: Green for Pemasukan, Red for Pengeluaran.

- [ ] **Step 2: Add into `DashboardView.tsx`**
Integrate beneath or tabbed next to `CashflowBreakdownCard`.

- [ ] **Step 3: Add CSS styles with zero raw hex in `src/styles/components.css`**
```css
.weekly-chart-card {
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 20px;
}

.weekly-chart-bars-container {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 140px;
  padding: 12px 4px 0;
  gap: 8px;
}

.weekly-bar-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  justify-content: flex-end;
}

.weekly-bar-pair {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 100px;
  width: 100%;
  justify-content: center;
}

.weekly-bar-income {
  background: var(--success-fg);
  border-radius: 3px 3px 0 0;
  width: 10px;
  min-height: 2px;
  transition: height 0.3s ease;
}

.weekly-bar-expense {
  background: var(--danger-fg);
  border-radius: 3px 3px 0 0;
  width: 10px;
  min-height: 2px;
  transition: height 0.3s ease;
}

.weekly-bar-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 6px;
}
```

- [ ] **Step 4: Commit Task 2**

```bash
git add src/features/dashboard/WeeklyCashflowChart.tsx src/features/dashboard/DashboardView.tsx src/styles/components.css
git commit -m "feat(dashboard): add WeeklyCashflowChart visualizer"
```

---

### Task 3: Comprehensive Verification & Gate Checks

- [ ] **Step 1: Zero Raw Hex Audit**
Run: `git grep -E "#[0-9a-fA-F]{3,8}\b" src/styles/components.css`
Expected: 0 matches

- [ ] **Step 2: Run all unit tests**
Run: `bun test src/`
Expected: All 35+ test suites pass

- [ ] **Step 3: Run all 14 E2E gates**
Run: `npm run test:e2e`
Expected: All 14 passed (163+ assertions)

- [ ] **Step 4: Deploy to Firebase Hosting**
Run: `npx -y firebase-tools deploy --only hosting`
Expected: Live deployment complete to `https://catat-8897d.web.app`
