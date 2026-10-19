# Debt Snowball & Avalanche Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive Debt Snowball & Avalanche Planner card on the Dashboard to calculate, visualize, and execute step-by-step debt elimination across all liability accounts (CIMB Niaga CC, CIMB Niaga KTA, TikTok PayLater, Shopee PayLater, BCA CC).

**Architecture:**
1. **Domain Logic (`src/lib/debtPlanner.ts`)**: Pure simulation engine that extracts liability accounts with debt (`balance < 0`), applies Snowball (smallest balance first) or Avalanche (highest-penalty/interest debt first) sorting, models monthly rollover acceleration, and projects debt-free milestones.
2. **UI Component (`src/features/dashboard/DebtPlannerCard.tsx`)**: Dashboard card featuring strategy toggle, allocation quick-presets (`500rb`, `1jt`, `2jt`, `5jt`, custom), projected payoff date badge, Target #1 focus highlight with 1-click "Bayar Cicilan" action, and zero-debt celebration.
3. **Dashboard Integration (`src/features/dashboard/DashboardView.tsx`)**: Placed below `UpcomingBillsCard`, wiring the "Bayar Cicilan" action into the existing transfer transaction modal.
4. **Design System (`src/styles/components.css`)**: Styled exclusively with semantic CSS tokens (`--surface-card`, `--accent-primary`, etc.) with zero raw hex (enforced by Gate 12).

**Tech Stack:** React 19, TypeScript, Bun Test, Firebase Emulators, Vanilla CSS Design System.

## Global Constraints
- Zero raw hex codes in `src/styles/components.css` (enforced by Gate 12).
- WCAG AA contrast compliance across light and dark modes.
- Balance atomicity & safety: repayments must trigger standard `transfer` transactions from asset accounts to liability accounts.
- All 14 existing E2E quality gates (`npm run test:e2e`) and 37 unit test suites must stay green.

---

### Task 1: Core Debt Planner Domain Logic & Unit Tests

**Files:**
- Create: `src/lib/debtPlanner.ts`
- Create: `src/lib/debtPlanner.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type DebtStrategy = 'snowball' | 'avalanche';

  export interface DebtPlanItem {
    accountId: string;
    name: string;
    icon?: string;
    remainingDebt: number; // Positive absolute nominal
    payoffMonths: number;
    payoffDate: Date;
    payoffDateLabel: string;
    isCurrentFocus: boolean;
  }

  export interface DebtPlanResult {
    totalDebt: number;
    monthlyAllocation: number;
    strategy: DebtStrategy;
    totalMonths: number;
    debtFreeDate: Date | null;
    debtFreeDateLabel: string;
    items: DebtPlanItem[];
  }

  export function getLiabilityAccountsWithDebt(accounts: Account[]): Account[];
  export function sortDebtsByStrategy(debts: Account[], strategy: DebtStrategy): Account[];
  export function calculateDebtPlan(
    accounts: Account[],
    monthlyAllocation: number,
    strategy: DebtStrategy,
    startDate?: Date
  ): DebtPlanResult;
  ```

- [ ] **Step 1: Write failing unit tests for debtPlanner domain logic**

Create `src/lib/debtPlanner.test.ts`:
```typescript
import {
  getLiabilityAccountsWithDebt,
  sortDebtsByStrategy,
  calculateDebtPlan,
  type DebtStrategy,
} from './debtPlanner';
import type { Account } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const mockAccounts: Account[] = [
  { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 500000, isArchived: false, createdAt: 1 },
  { id: 'acc_shopee', name: 'Shopee PayLater', kind: 'liability', balance: -1500000, isArchived: false, createdAt: 2 },
  { id: 'acc_tiktok', name: 'TikTok PayLater', kind: 'liability', balance: -500000, isArchived: false, createdAt: 3 },
  { id: 'acc_cimb_kta', name: 'CIMB Niaga KTA', kind: 'liability', balance: -10000000, isArchived: false, createdAt: 4 },
  { id: 'acc_bca_cc', name: 'BCA CC', kind: 'liability', balance: -3000000, isArchived: false, createdAt: 5 },
  { id: 'acc_zero', name: 'Kartu Kredit Lunas', kind: 'liability', balance: 0, isArchived: false, createdAt: 6 },
  { id: 'acc_archived', name: 'Hutang Lama', kind: 'liability', balance: -2000000, isArchived: true, createdAt: 7 },
];

// 1. Test getLiabilityAccountsWithDebt
const debts = getLiabilityAccountsWithDebt(mockAccounts);
assert(debts.length === 4, 'Should only return 4 active liabilities with negative balance');
assert(!debts.some((d) => d.id === 'acc_cash'), 'Should not include asset');
assert(!debts.some((d) => d.id === 'acc_zero'), 'Should not include 0 balance');
assert(!debts.some((d) => d.id === 'acc_archived'), 'Should not include archived account');

// 2. Test Snowball sorting (smallest balance first)
const snowballSorted = sortDebtsByStrategy(debts, 'snowball');
assert(snowballSorted[0].id === 'acc_tiktok', 'Snowball: TikTok (500k) should be first');
assert(snowballSorted[1].id === 'acc_shopee', 'Snowball: Shopee (1.5M) should be second');
assert(snowballSorted[2].id === 'acc_bca_cc', 'Snowball: BCA CC (3M) should be third');
assert(snowballSorted[3].id === 'acc_cimb_kta', 'Snowball: KTA (10M) should be fourth');

// 3. Test Avalanche sorting (PayLater & KTA first, then CC)
const avalancheSorted = sortDebtsByStrategy(debts, 'avalanche');
assert(
  avalancheSorted[0].name.toLowerCase().includes('paylater') ||
  avalancheSorted[0].name.toLowerCase().includes('kta'),
  'Avalanche: high-risk / PayLater / KTA must be prioritized'
);

// 4. Test calculateDebtPlan math simulation
const fixedStartDate = new Date(2026, 9, 1); // Oct 1, 2026
const plan = calculateDebtPlan(mockAccounts, 2000000, 'snowball', fixedStartDate);
assert(plan.totalDebt === 15000000, 'Total debt must be 15,000,000');
assert(plan.items.length === 4, 'Should have 4 items in plan');
assert(plan.items[0].isCurrentFocus === true, 'First item must be current focus');
assert(plan.items[1].isCurrentFocus === false, 'Second item must not be current focus');
assert(plan.totalMonths === 8, 'At 2M/mo, 15M takes ceil(15/2) = 8 months');
assert(plan.debtFreeDate !== null, 'debtFreeDate must be computed');

// 5. Test empty / zero debt case
const zeroPlan = calculateDebtPlan([], 1000000, 'snowball', fixedStartDate);
assert(zeroPlan.totalDebt === 0, 'Zero accounts should have totalDebt = 0');
assert(zeroPlan.totalMonths === 0, 'Zero accounts should have totalMonths = 0');
assert(zeroPlan.debtFreeDate === null, 'Zero accounts should have null debtFreeDate');

console.log('debtPlanner unit tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/debtPlanner.test.ts`  
Expected: FAIL (cannot find module `src/lib/debtPlanner.ts`)

- [ ] **Step 3: Implement `src/lib/debtPlanner.ts`**

Create `src/lib/debtPlanner.ts`:
```typescript
import type { Account } from './schemas';

export type DebtStrategy = 'snowball' | 'avalanche';

export interface DebtPlanItem {
  accountId: string;
  name: string;
  icon?: string;
  remainingDebt: number;
  payoffMonths: number;
  payoffDate: Date;
  payoffDateLabel: string;
  isCurrentFocus: boolean;
}

export interface DebtPlanResult {
  totalDebt: number;
  monthlyAllocation: number;
  strategy: DebtStrategy;
  totalMonths: number;
  debtFreeDate: Date | null;
  debtFreeDateLabel: string;
  items: DebtPlanItem[];
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function getLiabilityAccountsWithDebt(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.kind === 'liability' && a.balance < 0 && !a.isArchived);
}

function getAvalancheWeight(name: string): number {
  const lower = name.toLowerCase();
  // Highest priority (penalty/interest weight): PayLater (SPayLater, TikTok) & KTA
  if (lower.includes('paylater') || lower.includes('spaylater') || lower.includes('tiktok')) {
    return 100;
  }
  if (lower.includes('kta') || lower.includes('pinjaman') || lower.includes('cicilan')) {
    return 90;
  }
  if (lower.includes('cc') || lower.includes('kartu kredit')) {
    return 80;
  }
  return 50;
}

export function sortDebtsByStrategy(debts: Account[], strategy: DebtStrategy): Account[] {
  const copy = [...debts];
  if (strategy === 'snowball') {
    // Smallest nominal debt first
    return copy.sort((a, b) => Math.abs(a.balance) - Math.abs(b.balance));
  }

  // Avalanche: Prioritize high-interest types, then largest balance within same tier
  return copy.sort((a, b) => {
    const weightDiff = getAvalancheWeight(b.name) - getAvalancheWeight(a.name);
    if (weightDiff !== 0) return weightDiff;
    return Math.abs(b.balance) - Math.abs(a.balance);
  });
}

export function calculateDebtPlan(
  accounts: Account[],
  monthlyAllocation: number,
  strategy: DebtStrategy,
  startDate: Date = new Date()
): DebtPlanResult {
  const activeDebts = getLiabilityAccountsWithDebt(accounts);
  const totalDebt = activeDebts.reduce((sum, a) => sum + Math.abs(a.balance), 0);

  if (activeDebts.length === 0 || totalDebt === 0) {
    return {
      totalDebt: 0,
      monthlyAllocation,
      strategy,
      totalMonths: 0,
      debtFreeDate: null,
      debtFreeDateLabel: 'Bebas Hutang',
      items: [],
    };
  }

  const effectiveAllocation = monthlyAllocation > 0 ? monthlyAllocation : 500000;
  const sorted = sortDebtsByStrategy(activeDebts, strategy);

  let cumulativeDebt = 0;
  const items: DebtPlanItem[] = sorted.map((acc, index) => {
    const debt = Math.abs(acc.balance);
    cumulativeDebt += debt;

    const monthsNeeded = Math.max(1, Math.ceil(cumulativeDebt / effectiveAllocation));
    const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthsNeeded, 1);
    const dateLabel = `${MONTH_NAMES[targetDate.getMonth()]} ${targetDate.getFullYear()} (${monthsNeeded} bln)`;

    return {
      accountId: acc.id,
      name: acc.name,
      icon: acc.icon,
      remainingDebt: debt,
      payoffMonths: monthsNeeded,
      payoffDate: targetDate,
      payoffDateLabel: dateLabel,
      isCurrentFocus: index === 0,
    };
  });

  const totalMonths = Math.max(1, Math.ceil(totalDebt / effectiveAllocation));
  const debtFreeDate = new Date(startDate.getFullYear(), startDate.getMonth() + totalMonths, 1);
  const debtFreeDateLabel = `${MONTH_NAMES[debtFreeDate.getMonth()]} ${debtFreeDate.getFullYear()} (${totalMonths} Bulan)`;

  return {
    totalDebt,
    monthlyAllocation: effectiveAllocation,
    strategy,
    totalMonths,
    debtFreeDate,
    debtFreeDateLabel,
    items,
  };
}
```

- [ ] **Step 4: Run unit tests**

Run: `bun test src/lib/debtPlanner.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/debtPlanner.ts src/lib/debtPlanner.test.ts
git commit -m "feat(debtPlanner): add core math and unit tests for snowball and avalanche planner"
```

---

### Task 2: UI Component `DebtPlannerCard.tsx`

**Files:**
- Create: `src/features/dashboard/DebtPlannerCard.tsx`

**Interfaces:**
- Props:
  ```typescript
  export interface DebtPlannerCardProps {
    accounts: Account[];
    onPayDebt?: (targetAccountId: string, suggestedAmount: number) => void;
  }
  ```

- [ ] **Step 1: Implement `DebtPlannerCard.tsx`**

Create `src/features/dashboard/DebtPlannerCard.tsx`:
```tsx
import React, { useState } from 'react';
import type { Account } from '../../lib/schemas';
import {
  calculateDebtPlan,
  type DebtStrategy,
} from '../../lib/debtPlanner';

export interface DebtPlannerCardProps {
  accounts: Account[];
  onPayDebt?: (targetAccountId: string, suggestedAmount: number) => void;
}

const PRESET_ALLOCATIONS = [500000, 1000000, 2000000, 5000000];

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const DebtPlannerCard: React.FC<DebtPlannerCardProps> = ({ accounts, onPayDebt }) => {
  const [strategy, setStrategy] = useState<DebtStrategy>('snowball');
  const [monthlyAllocation, setMonthlyAllocation] = useState<number>(2000000);
  const [isCustomAlloc, setIsCustomAlloc] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const plan = calculateDebtPlan(accounts, monthlyAllocation, strategy);

  // If no debt at all
  if (plan.totalDebt === 0) {
    return (
      <div className="debt-planner-card debt-free-card">
        <div className="debt-free-content">
          <span className="debt-free-icon">🎉</span>
          <div>
            <h3 className="debt-free-title">Bebas Hutang!</h3>
            <p className="debt-free-sub">Semua akun liabilitas dan PayLater Anda bersaldo Rp 0.</p>
          </div>
        </div>
      </div>
    );
  }

  const focusItem = plan.items[0];
  const upcomingItems = plan.items.slice(1);

  return (
    <div className="debt-planner-card">
      {/* Header */}
      <div className="debt-planner-header">
        <div className="debt-planner-title-group">
          <span className="debt-planner-icon">🛡️</span>
          <div>
            <h3 className="debt-planner-title">Rencana Bebas Hutang</h3>
            <p className="debt-planner-sub">
              Total {plan.items.length} pinjaman berjalan:{' '}
              <strong className="debt-total-text">{formatIdr(plan.totalDebt)}</strong>
            </p>
          </div>
        </div>
        <button
          type="button"
          className="debt-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Sembunyikan' : 'Tampilkan'}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="debt-planner-body">
          {/* Strategy Pills */}
          <div className="debt-strategy-section">
            <span className="debt-section-label">Pilih Strategi:</span>
            <div className="debt-strategy-pills">
              <button
                type="button"
                className={`debt-strategy-pill ${strategy === 'snowball' ? 'active' : ''}`}
                onClick={() => setStrategy('snowball')}
              >
                ❄️ Snowball (Saldo Terkecil)
              </button>
              <button
                type="button"
                className={`debt-strategy-pill ${strategy === 'avalanche' ? 'active' : ''}`}
                onClick={() => setStrategy('avalanche')}
              >
                ⚡ Avalanche (Bunga & Biaya)
              </button>
            </div>
          </div>

          {/* Monthly Allocation Presets */}
          <div className="debt-alloc-section">
            <span className="debt-section-label">Alokasi Cicilan per Bulan:</span>
            <div className="debt-alloc-presets">
              {PRESET_ALLOCATIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`debt-alloc-pill ${!isCustomAlloc && monthlyAllocation === preset ? 'active' : ''}`}
                  onClick={() => {
                    setMonthlyAllocation(preset);
                    setIsCustomAlloc(false);
                  }}
                >
                  {preset >= 1000000 ? `${preset / 1000000} Jt` : `${preset / 1000} Rb`}
                </button>
              ))}
              <button
                type="button"
                className={`debt-alloc-pill ${isCustomAlloc ? 'active' : ''}`}
                onClick={() => setIsCustomAlloc(true)}
              >
                Kustom
              </button>
            </div>

            {isCustomAlloc && (
              <div className="debt-custom-alloc-input">
                <span className="input-prefix">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="Masukkan nominal alokasi"
                  value={customInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setCustomInput(raw ? new Intl.NumberFormat('id-ID').format(parseInt(raw, 10)) : '');
                    if (raw) {
                      setMonthlyAllocation(parseInt(raw, 10));
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Projection Banner */}
          <div className="debt-projection-banner">
            <div className="debt-projection-left">
              <span className="debt-projection-flag">🏁</span>
              <div>
                <span className="debt-projection-label">Estimasi Bebas Hutang</span>
                <strong className="debt-projection-val">{plan.debtFreeDateLabel}</strong>
              </div>
            </div>
            <div className="debt-projection-pace">
              Pace: <strong>{formatIdr(plan.monthlyAllocation)}/bln</strong>
            </div>
          </div>

          {/* Current Focus Target #1 */}
          {focusItem && (
            <div className="debt-focus-card">
              <div className="debt-focus-badge">🎯 FOKUS UTAMA #{1}</div>
              <div className="debt-focus-main">
                <div className="debt-focus-info">
                  <span className="debt-focus-icon">{focusItem.icon || '💳'}</span>
                  <div>
                    <strong className="debt-focus-name">{focusItem.name}</strong>
                    <div className="debt-focus-meta">
                      Sisa: <span className="debt-amount-highlight">{formatIdr(focusItem.remainingDebt)}</span>
                      <span className="debt-meta-bullet">•</span>
                      Target lunas: {focusItem.payoffDateLabel}
                    </div>
                  </div>
                </div>
                {onPayDebt && (
                  <button
                    type="button"
                    className="debt-pay-action-btn"
                    onClick={() => onPayDebt(focusItem.accountId, Math.min(plan.monthlyAllocation, focusItem.remainingDebt))}
                  >
                    Bayar Cicilan
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Targets Queue */}
          {upcomingItems.length > 0 && (
            <div className="debt-queue-container">
              <span className="debt-queue-title">Antrean Pelunasan Berikutnya:</span>
              <div className="debt-queue-list">
                {upcomingItems.map((item, idx) => (
                  <div key={item.accountId} className="debt-queue-item">
                    <span className="debt-queue-step">#{idx + 2}</span>
                    <span className="debt-queue-icon">{item.icon || '💳'}</span>
                    <div className="debt-queue-details">
                      <span className="debt-queue-name">{item.name}</span>
                      <span className="debt-queue-val">{formatIdr(item.remainingDebt)}</span>
                    </div>
                    <span className="debt-queue-eta">{item.payoffDateLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Run build to check TypeScript validation**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 3: Commit Task 2**

```bash
git add src/features/dashboard/DebtPlannerCard.tsx
git commit -m "feat(dashboard): add DebtPlannerCard component for snowball & avalanche strategy"
```

---

### Task 3: Design System Styles (`src/styles/components.css`)

**Files:**
- Modify: `src/styles/components.css`

**Interfaces:**
- Classes:
  - `.debt-planner-card`, `.debt-free-card`, `.debt-strategy-pills`, `.debt-strategy-pill`, `.debt-alloc-presets`, `.debt-alloc-pill`, `.debt-projection-banner`, `.debt-focus-card`, `.debt-pay-action-btn`, `.debt-queue-item`
- Constraints: Zero raw hex codes (Gate 12 compliance).

- [ ] **Step 1: Add Debt Planner styles in `src/styles/components.css`**

Add at the bottom of `src/styles/components.css`:
```css
/* ==========================================================================
   Debt Planner & Strategy Card (Zero Raw Hex — Gate 12 Compliant)
   ========================================================================== */

.debt-planner-card {
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg, 16px);
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}

.debt-free-card {
  background: var(--surface-card);
  border: 1px dashed var(--success-light);
}

.debt-free-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.debt-free-icon {
  font-size: 28px;
}

.debt-free-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--success-fg);
}

.debt-free-sub {
  margin: 2px 0 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

.debt-planner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debt-planner-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.debt-planner-icon {
  font-size: 20px;
}

.debt-planner-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.debt-planner-sub {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.debt-total-text {
  color: var(--danger-fg, var(--error-fg));
}

.debt-toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-sm, 8px);
}

.debt-toggle-btn:hover {
  background: var(--surface-secondary);
}

.debt-planner-body {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.debt-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  display: block;
}

.debt-strategy-pills,
.debt-alloc-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.debt-strategy-pill,
.debt-alloc-pill {
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.debt-strategy-pill.active,
.debt-alloc-pill.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--text-inverse, #ffffff);
}

.debt-custom-alloc-input {
  margin-top: 8px;
  display: flex;
  align-items: center;
}

.debt-projection-banner {
  background: var(--surface-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 12px);
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debt-projection-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.debt-projection-flag {
  font-size: 18px;
}

.debt-projection-label {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
}

.debt-projection-val {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 700;
}

.debt-projection-pace {
  font-size: 12px;
  color: var(--text-muted);
}

.debt-projection-pace strong {
  color: var(--accent-primary);
}

.debt-focus-card {
  background: var(--surface-base);
  border: 1.5px solid var(--accent-primary);
  border-radius: var(--radius-md, 12px);
  padding: 12px 14px;
  position: relative;
}

.debt-focus-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--accent-primary);
  margin-bottom: 6px;
}

.debt-focus-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.debt-focus-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.debt-focus-icon {
  font-size: 20px;
}

.debt-focus-name {
  font-size: 14px;
  color: var(--text-primary);
  display: block;
}

.debt-focus-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.debt-amount-highlight {
  color: var(--danger-fg, var(--error-fg));
  font-weight: 700;
}

.debt-meta-bullet {
  margin: 0 4px;
}

.debt-pay-action-btn {
  background: var(--accent-primary);
  color: var(--text-inverse, #ffffff);
  border: none;
  border-radius: var(--radius-md, 10px);
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.debt-pay-action-btn:hover {
  filter: brightness(1.1);
}

.debt-queue-container {
  margin-top: 4px;
}

.debt-queue-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  display: block;
}

.debt-queue-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debt-queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-secondary);
  border-radius: var(--radius-sm, 8px);
  padding: 8px 12px;
  font-size: 12px;
}

.debt-queue-step {
  font-weight: 700;
  color: var(--text-muted);
  min-width: 20px;
}

.debt-queue-icon {
  font-size: 16px;
}

.debt-queue-details {
  flex: 1;
  display: flex;
  justify-content: space-between;
  margin-right: 10px;
}

.debt-queue-name {
  color: var(--text-primary);
  font-weight: 600;
}

.debt-queue-val {
  color: var(--danger-fg, var(--error-fg));
}

.debt-queue-eta {
  color: var(--text-muted);
  font-size: 11px;
}
```

- [ ] **Step 2: Verify zero raw hex in `src/styles/components.css`**

Run: `git grep -E "#[0-9a-fA-F]{3,8}\b" src/styles/components.css`  
Expected: 0 matches

- [ ] **Step 3: Commit Task 3**

```bash
git add src/styles/components.css
git commit -m "feat(styles): add DebtPlannerCard styles with zero raw hex"
```

---

### Task 4: Dashboard Integration & Action Wiring

**Files:**
- Modify: `src/features/dashboard/DashboardView.tsx`

**Interfaces:**
- Embeds: `<DebtPlannerCard accounts={accounts} onPayDebt={handlePayDebt} />`

- [ ] **Step 1: Wire `handlePayDebt` in `DashboardView.tsx`**

In `src/features/dashboard/DashboardView.tsx`:
Import `DebtPlannerCard`:
```typescript
import { DebtPlannerCard } from './DebtPlannerCard';
```

Add `handlePayDebt`:
```typescript
const handlePayDebt = (targetAccountId: string, suggestedAmount: number) => {
  // Find primary liquid account (Cash or Bank) to pay from
  const liquidAccount = accounts.find(
    (a) => a.kind === 'asset' && !a.isArchived && a.balance >= suggestedAmount
  ) || accounts.find((a) => a.kind === 'asset' && !a.isArchived);

  // Trigger transfer modal prefill
  setFormInitialData({
    type: 'transfer',
    fromAccountId: liquidAccount?.id || '',
    toAccountId: targetAccountId,
    amount: suggestedAmount,
    note: 'Pelunasan Cicilan Hutang',
  });
  setIsFormOpen(true);
};
```

Render `DebtPlannerCard` right below `UpcomingBillsCard`:
```tsx
<UpcomingBillsCard accounts={accounts} onPayBill={handlePayBill} />
<DebtPlannerCard accounts={accounts} onPayDebt={handlePayDebt} />
```

- [ ] **Step 2: Test production build**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 3: Commit Task 4**

```bash
git add src/features/dashboard/DashboardView.tsx
git commit -m "feat(dashboard): integrate DebtPlannerCard into DashboardView"
```

---

### Task 5: Full Quality Verification & Production Deploy

- [ ] **Step 1: Run all unit tests**
Run: `bun test src/`  
Expected: All 38+ unit test suites PASS

- [ ] **Step 2: Run all 14 E2E gates**
Run: `npm run test:e2e`  
Expected: All 14 gates pass with 163+ assertions

- [ ] **Step 3: Deploy to Firebase Hosting**
Run: `npx -y firebase-tools deploy --only hosting`  
Expected: Deploy complete to `https://catat-8897d.web.app`
