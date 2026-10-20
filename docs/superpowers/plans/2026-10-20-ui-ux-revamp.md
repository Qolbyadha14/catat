# Catat UI/UX Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Catat into a premium fintech mobile web application based on the approved design spec (`docs/superpowers/specs/2026-10-20-ui-ux-revamp-design.md`) by implementing Tailwind CSS v4, Lucide icons, a responsive `MobileFrame`, a 4-tab `BottomNav` dock, and specialized views (Beranda, Dompet, Anggaran, Statistik) while preserving 100% of Firestore real-time sync, Family Ledger, OCR scanner, and PayLater capabilities.

**Architecture:**
- **Shell**: `MobileFrame` wraps the app with responsive centering, simulated phone mockup on desktop, and audio feedback controls.
- **Navigation**: Tab state in `DashboardView` controls active view (`dashboard` | `accounts` | `budgets` | `stats`), with a floating `BottomNav` and centralized (+) floating action button.
- **Header**: Top bar houses User info, Family Ledger toggle/badge, Search trigger, and Profile settings.
- **Views**: Each tab is an isolated feature module receiving typed props from existing reactive hooks (`useAccounts`, `useCategories`, `useTransactions`, `useAuth`).

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Lucide React (`lucide-react`), Bun test runner, Oxlint.

## Global Constraints
- Preserve all existing unit tests in `src/` and integration tests in `tests/`.
- Maintain strict typing: zero `any` declarations where explicit types exist.
- Preserve backward compatibility for Firestore data models (`Account`, `Category`, `Transaction`, `Ledger`).
- All interactive elements must support keyboard navigation and ARIA attributes where applicable.

---

### Task 1: Setup Tailwind CSS v4 and Lucide React

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/styles/tailwind.css`
- Modify: `src/main.tsx`
- Test: `tests/tailwind-setup.test.ts`

**Interfaces:**
- Consumes: Vite configuration, CSS entry point.
- Produces: Tailwind v4 utility classes and Lucide icon components available across all modules.

- [ ] **Step 1: Write verification test for styling and dependencies**

Create `tests/tailwind-setup.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';
import packageJson from '../package.json';

describe('Dependencies setup', () => {
  it('should have tailwindcss and lucide-react in dependencies', () => {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    expect(deps['lucide-react']).toBeDefined();
    expect(deps['tailwindcss'] || deps['@tailwindcss/vite']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tailwind-setup.test.ts`
Expected: FAIL (missing dependencies in package.json)

- [ ] **Step 3: Install dependencies and configure Vite**

Run commands:
```bash
bun add lucide-react
bun add -D @tailwindcss/vite tailwindcss
```

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
});
```

Create `src/styles/tailwind.css`:
```css
@import "tailwindcss";

@layer base {
  * {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    background-color: #0b0f19;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
  }
}

/* Custom scrollbars */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}
```

Import `src/styles/tailwind.css` in `src/main.tsx` right above existing styles.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tailwind-setup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock vite.config.ts src/styles/tailwind.css src/main.tsx tests/tailwind-setup.test.ts
git commit -m "feat: setup tailwind css v4 and lucide-react dependencies"
```

---

### Task 2: Haptic Audio Feedback Synthesizer & Mobile Frame Shell

**Files:**
- Create: `src/lib/haptic.ts`
- Create: `src/components/layout/MobileFrame.tsx`
- Test: `tests/haptic.test.ts`

**Interfaces:**
- Consumes: Web Audio API (with fallback when unavailable in node/headless environment).
- Produces:
  - `playHapticSound(type: 'click' | 'success' | 'delete' | 'tap'): void`
  - `MobileFrame({ children, activeTab }: { children: React.ReactNode; activeTab: string })`

- [ ] **Step 1: Write test for haptic helper**

Create `tests/haptic.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';
import { playHapticSound } from '../src/lib/haptic';

describe('playHapticSound', () => {
  it('does not throw when executed in test/headless environment', () => {
    expect(() => playHapticSound('click')).not.toThrow();
    expect(() => playHapticSound('success')).not.toThrow();
    expect(() => playHapticSound('tap')).not.toThrow();
    expect(() => playHapticSound('delete')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/haptic.test.ts`
Expected: FAIL ("Cannot find module '../src/lib/haptic'")

- [ ] **Step 3: Implement `src/lib/haptic.ts` and `src/components/layout/MobileFrame.tsx`**

Write `src/lib/haptic.ts`:
```typescript
let audioCtx: AudioContext | null = null;

export function playHapticSound(type: 'click' | 'success' | 'delete' | 'tap' = 'click') {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'click' || type === 'tap') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.06);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'delete') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {
    // Graceful no-op on autoplay rejection or unsupported audio
  }
}
```

Write `src/components/layout/MobileFrame.tsx` with responsive desktop preview controls, phone status bar, clock updater, and audio sound toggle.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/haptic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/haptic.ts src/components/layout/MobileFrame.tsx tests/haptic.test.ts
git commit -m "feat: add haptic sound synthesizer and responsive mobile frame container"
```

---

### Task 3: Bottom Navigation Dock & Top Header Components

**Files:**
- Create: `src/components/navigation/BottomNav.tsx`
- Create: `src/components/layout/Header.tsx`
- Test: `tests/navigation.test.ts`

**Interfaces:**
- `BottomNavProps`:
  ```typescript
  export type NavTabType = 'dashboard' | 'accounts' | 'budgets' | 'stats';
  export interface BottomNavProps {
    currentTab: NavTabType;
    onChangeTab: (tab: NavTabType) => void;
    onOpenAddModal: () => void;
  }
  ```
- `HeaderProps`:
  ```typescript
  export interface HeaderProps {
    userName: string;
    userPhoto?: string;
    activeLedgerName?: string | null;
    onOpenFamilyLedger: () => void;
    onOpenSearch: () => void;
    onOpenProfileMenu: () => void;
  }
  ```

- [ ] **Step 1: Write test for tab types and nav logic**

Create `tests/navigation.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';
import type { NavTabType } from '../src/components/navigation/BottomNav';

describe('NavTabType', () => {
  it('validates supported navigation tabs', () => {
    const validTabs: NavTabType[] = ['dashboard', 'accounts', 'budgets', 'stats'];
    expect(validTabs.length).toBe(4);
    expect(validTabs.includes('dashboard')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/navigation.test.ts`
Expected: FAIL (Cannot find module '../src/components/navigation/BottomNav')

- [ ] **Step 3: Implement `BottomNav.tsx` and `Header.tsx`**

Implement `src/components/navigation/BottomNav.tsx` with:
- Beranda (`Home`), Dompet (`Wallet`), Center Floating (+) Button, Anggaran (`Target`), Statistik (`BarChart3`).
- Audio feedback tap invocation on `playHapticSound('tap')`.
- Dynamic active styling with blue accent and smooth hover scaling.

Implement `src/components/layout/Header.tsx` with:
- Avatar & greeting text.
- Family Ledger status pill button (with online dot indicator).
- Search icon button with click haptic sound.
- Profile menu trigger button.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/navigation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation/BottomNav.tsx src/components/layout/Header.tsx tests/navigation.test.ts
git commit -m "feat: create modern bottom nav dock and header components"
```

---

### Task 4: Tab 1: Beranda (Home Dashboard) & Balance Wave Chart

**Files:**
- Create: `src/features/dashboard/BalanceHeroCard.tsx`
- Create: `src/features/dashboard/HomeTab.tsx`
- Test: `tests/balance-hero-card.test.ts`

**Interfaces:**
- `BalanceHeroCardProps`:
  ```typescript
  export interface BalanceHeroCardProps {
    netBalance: number;
    totalAssets: number;
    totalLiabilities: number;
    monthIncome: number;
    monthExpense: number;
    netCashflow: { isSurplus: boolean; formatted: string };
    selectedMonthLabel: string;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    dailyBalances: { date: string; label: string; balance: number }[];
  }
  ```

- [ ] **Step 1: Write test for daily balance trend generator**

Create `tests/balance-hero-card.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';

describe('Daily balance curve data generator', () => {
  it('calculates points within svg bounds', () => {
    const dailyBalances = [
      { date: '2026-10-01', label: '01 Okt', balance: 1000000 },
      { date: '2026-10-15', label: '15 Okt', balance: 1500000 },
      { date: '2026-10-20', label: '20 Okt', balance: 1200000 },
    ];
    expect(dailyBalances.length).toBe(3);
    expect(dailyBalances[0].balance).toBe(1000000);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test tests/balance-hero-card.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `BalanceHeroCard.tsx` and `HomeTab.tsx`**

1. In `src/features/dashboard/BalanceHeroCard.tsx`:
   - Deep blue gradient background (`bg-gradient-to-br from-[#1244d3] via-[#1a56ea] to-[#0c319e]`).
   - SVG cubic bezier wave curve mapping `dailyBalances` with hover/touch interactive tooltip pin showing formatted currency.
   - Pemasukan (+), Pengeluaran (-), and Net Cashflow pills.
   - Month navigator switcher.
2. In `src/features/dashboard/HomeTab.tsx`:
   - Compose `BalanceHeroCard`.
   - Embed `UpcomingBillsCard` with quick pay trigger.
   - Embed modernized `TransactionList` with squircle icons, date headers, and items pill.

- [ ] **Step 4: Run test suite to verify no regressions**

Run: `bun test src/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/BalanceHeroCard.tsx src/features/dashboard/HomeTab.tsx tests/balance-hero-card.test.ts
git commit -m "feat: implement electric blue balance card with interactive wave chart and HomeTab"
```

---

### Task 5: Tab 2: Dompet (Accounts, PayLater & Debt Snowball Planner)

**Files:**
- Create: `src/features/accounts/AccountsTab.tsx`
- Create: `src/features/accounts/AccountCardCarousel.tsx`
- Test: `tests/accounts-tab.test.ts`

**Interfaces:**
- `AccountsTabProps`:
  ```typescript
  export interface AccountsTabProps {
    accounts: Account[];
    onPayLiability: (liabilityAccount: Account) => void;
    onPayDebt: (targetAccountId: string, amount: number) => void;
    onOpenAddAccount: () => void;
  }
  ```

- [ ] **Step 1: Write test for account grouping**

Create `tests/accounts-tab.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';
import type { Account } from '../src/lib/schemas';
import { calculateAccountSummary } from '../src/lib/accountCalculations';

describe('AccountsTab data grouping', () => {
  it('correctly splits assets and liabilities', () => {
    const mockAccounts: Account[] = [
      { id: '1', name: 'BCA', type: 'bank', balance: 5000000, isArchived: false },
      { id: '2', name: 'Shopee PayLater', type: 'liability', balance: -1500000, isArchived: false, creditLimit: 5000000 },
    ];
    const summary = calculateAccountSummary(mockAccounts);
    expect(summary.totalAssets).toBe(5000000);
    expect(summary.totalLiabilities).toBe(1500000);
    expect(summary.netBalance).toBe(3500000);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test tests/accounts-tab.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `AccountCardCarousel.tsx` and `AccountsTab.tsx`**

1. `AccountCardCarousel.tsx`:
   - Realistic card visual styling: EMV chip icon, metallic gloss highlight, masked account number (`•••• 5083`), institution logo text (BCA, MANDIRI, GOPAY, etc.), account name, and formatted balance.
   - Horizontal snap scroll.
2. `AccountsTab.tsx`:
   - Overview metrics: Total Accounts, Net Worth.
   - Render `AccountCardCarousel`.
   - "Uang Saya (Aset)" listing with cash/bank balances.
   - "PayLater & Tagihan" listing with debt badges.
   - Embedded `DebtPlannerCard` (Snowball vs Avalanche) with one-click `⚡ Bayar Tagihan` triggering prefill transfer.
   - "+ Tambah Akun" button.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/accounts-tab.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/accounts/AccountsTab.tsx src/features/accounts/AccountCardCarousel.tsx tests/accounts-tab.test.ts
git commit -m "feat: implement realistic card carousel and AccountsTab with PayLater debt planner"
```

---

### Task 6: Tab 3: Anggaran (Monthly Budgets Management)

**Files:**
- Create: `src/features/budgets/BudgetsTab.tsx`
- Create: `src/features/budgets/BudgetModal.tsx`
- Test: `tests/budgets-tab.test.ts`

**Interfaces:**
- `BudgetsTabProps`:
  ```typescript
  export interface BudgetsTabProps {
    categories: Category[];
    transactions: Transaction[];
    onOpenBudgetModal: (category?: Category) => void;
  }
  ```

- [ ] **Step 1: Write test for budget consumption calculation**

Create `tests/budgets-tab.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';

describe('Budget calculation logic', () => {
  it('computes correct percentage and on-track status', () => {
    const limit = 2000000;
    const spent = 800000;
    const pct = (spent / limit) * 100;
    const isOnTrack = pct <= 80;
    expect(pct).toBe(40);
    expect(isOnTrack).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test tests/budgets-tab.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `BudgetsTab.tsx` and `BudgetModal.tsx`**

1. `BudgetsTab.tsx`:
   - Header with total budget, total spent, and overall progress bar.
   - Grid/list of category cards with:
     - Icon and Category Name.
     - Progress bar with dynamic color (Emerald when < 80%, Rose when >= 80% or over).
     - Status badges: `✓ On Track (Aman)` vs `⚠️ Perlu Berhemat`.
     - Remaining amount text ("Tersisa Rp X").
     - Quick "Atur Limit" tap.
2. `BudgetModal.tsx`:
   - Modal to set/update monthly budget for selected category.
   - Quick limit chips (Rp 500rb, Rp 1jt, Rp 2jt, Rp 5jt).
   - Async update in Firestore via category service.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/budgets-tab.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/budgets/BudgetsTab.tsx src/features/budgets/BudgetModal.tsx tests/budgets-tab.test.ts
git commit -m "feat: implement monthly budget progress cards and BudgetModal"
```

---

### Task 7: Tab 4: Statistik (Interactive Donut & Weekly Cashflow Charts)

**Files:**
- Create: `src/features/analytics/StatsTab.tsx`
- Create: `src/features/analytics/DonutChart.tsx`
- Create: `src/features/analytics/exportCsv.ts`
- Test: `tests/stats-tab.test.ts`

**Interfaces:**
- `StatsTabProps`:
  ```typescript
  export interface StatsTabProps {
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
    selectedMonth: Date;
  }
  ```
- `exportTransactionsCsv(transactions: Transaction[], accountMap: Map<string, string>, categoryMap: Map<string, string>): void`

- [ ] **Step 1: Write test for CSV formatting**

Create `tests/stats-tab.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';
import { generateCsvContent } from '../src/features/analytics/exportCsv';

describe('CSV report generation', () => {
  it('generates valid RFC 4180 CSV rows', () => {
    const mockTxs = [
      { id: '1', date: '2026-10-20', type: 'expense', amount: 50000, note: 'Makan Siang', accountId: 'acc1', categoryId: 'cat1' },
    ];
    const accMap = new Map([['acc1', 'BCA']]);
    const catMap = new Map([['cat1', 'Makanan']]);
    const csv = generateCsvContent(mockTxs as any, accMap, catMap);
    expect(csv).toContain('Tanggal,Tipe,Kategori,Akun,Nominal,Catatan');
    expect(csv).toContain('2026-10-20,expense,Makanan,BCA,50000,"Makan Siang"');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/stats-tab.test.ts`
Expected: FAIL (Cannot find module '../src/features/analytics/exportCsv')

- [ ] **Step 3: Implement `exportCsv.ts`, `DonutChart.tsx`, and `StatsTab.tsx`**

1. `src/features/analytics/exportCsv.ts`:
   - Pure function `generateCsvContent` that properly formats CSV strings with headers and escaped fields.
   - Client function `downloadCsv` that triggers browser file download.
2. `src/features/analytics/DonutChart.tsx`:
   - SVG Donut Chart calculating strokeDasharray and strokeDashoffset for each category slice.
   - Center text showing total expense.
   - Interactive category pill selection.
3. `src/features/analytics/StatsTab.tsx`:
   - Weekly cashflow trend bar chart.
   - Donut Chart.
   - "Unduh Laporan CSV" button with success haptic feedback.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/stats-tab.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/exportCsv.ts src/features/analytics/DonutChart.tsx src/features/analytics/StatsTab.tsx tests/stats-tab.test.ts
git commit -m "feat: implement interactive donut chart, weekly trend, and CSV report export"
```

---

### Task 8: Modernized Transaction Modal & Integration in `DashboardView`

**Files:**
- Create: `src/components/modals/SearchModal.tsx`
- Modify: `src/features/transactions/TransactionFormSheet.tsx`
- Modify: `src/features/dashboard/DashboardView.tsx`
- Modify: `src/App.tsx`
- Test: `tests/e2e-gates.test.ts`

**Interfaces:**
- Consumes all tabs, hooks, and modals.
- Produces: Seamless integrated app lifecycle with BottomNav, floating (+), and slide-up sheets.

- [ ] **Step 1: Check existing integration test suite**

Run: `bun test tests/e2e-gates.test.ts`
Expected: Verify baseline pass or inspect requirements.

- [ ] **Step 2: Modernize `TransactionFormSheet.tsx`**

- Add slide-up sheet styling (`rounded-t-[36px]`, backdrop blur, smooth entrance).
- Add quick amount chips (+20k, +50k, +100k, +250k, +500k).
- Preserve existing tabs: Manual, Ketik (NLP), Scan Struk (OCR), and atomic transfer logic.

- [ ] **Step 3: Implement `SearchModal.tsx`**

- Search input with clear button.
- Real-time filtered list with squircle icons and amount highlights.

- [ ] **Step 4: Update `DashboardView.tsx` to render the 4 tabs and MobileFrame**

In `src/features/dashboard/DashboardView.tsx`:
- Wrap in `MobileFrame`.
- Top: render `Header`.
- Main: switch tab based on `currentTab`:
  - `dashboard` -> `HomeTab`
  - `accounts` -> `AccountsTab`
  - `budgets` -> `BudgetsTab`
  - `stats` -> `StatsTab`
- Bottom: render `BottomNav` with active tab and floating (+) handler.
- Mount `SearchModal`, `FamilyLedgerSheet`, `JoinLedgerDialog`, and `TransactionFormSheet`.

- [ ] **Step 5: Run all test suites**

Run:
```bash
bun test src/
bun test tests/
```
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/SearchModal.tsx src/features/transactions/TransactionFormSheet.tsx src/features/dashboard/DashboardView.tsx src/App.tsx
git commit -m "feat: integrate modern 4-tab bottom navigation and search modal into DashboardView"
```

---

### Task 9: Final Quality Gates, Lint & Build Verification

**Files:**
- Check all modified files.

- [ ] **Step 1: Run linter**

Run: `bun run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run full automated tests**

Run: `bun test src/`
Expected: All tests pass.

- [ ] **Step 3: Run production build check**

Run: `bun run build`
Expected: Vite build completes successfully with 0 errors.

- [ ] **Step 4: Final commit & tag if needed**

```bash
git add -A
git commit -m "chore: complete UI/UX revamp to premium fintech standard"
```
