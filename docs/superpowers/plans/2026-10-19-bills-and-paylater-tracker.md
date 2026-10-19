# Bills & PayLater Tracker (Pengingat Tagihan & Jatuh Tempo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an automated billing and due date tracker for PayLater and liability accounts in Catat, showing countdown alerts on the dashboard with outstanding balances and a 1-click "Bayar Sekarang" action that pre-fills a transfer to settle the balance.

**Architecture:**
1. **Domain Logic (`src/lib/bills.ts`)**: Pure calculation functions for due date math, computing days remaining until due day (`dueDay: 1–31`), overdue status, outstanding bill amounts from negative liability balances (`balance < 0 ? Math.abs(balance) : 0`), and sorting upcoming bills by urgency.
2. **Schema & Account Service (`src/lib/schemas.ts`, `src/features/accounts/accountService.ts`)**: Extends `accountSchema` with optional `dueDay?: number` (integer 1–31). Backward-compatible with existing accounts and Firestore rules.
3. **Manage Accounts UI (`src/features/manage/ManageSheet.tsx`)**: Allows users to specify a monthly due date when adding/editing liability accounts (e.g. *Tanggal Jatuh Tempo: 25*) and displays an alert badge in the account list.
4. **Dashboard Reminder Card (`src/features/dashboard/UpcomingBillsCard.tsx`, `DashboardView.tsx`)**: Displays an urgent bills card above accounts when there are outstanding bills due within 7 days, complete with countdown chip and a 1-click "Bayar" button.
5. **1-Click Settlement Flow**: Clicking "Bayar" opens `TransactionFormSheet` prefilled as `type: 'transfer'`, `toAccountId: account.id`, and `amount: outstandingBalance`.

**Tech Stack:** React 19, TypeScript, Firestore, Bun Test, Vanilla CSS Design System.

## Global Constraints
- Zero raw hex codes in `src/styles/components.css` (enforced by Gate 12).
- WCAG AA contrast compliance: text >= 4.5:1, graphical UI >= 3:1 in both light and dark modes.
- Backward compatibility: Existing accounts without `dueDay` work seamlessly.
- All 14 existing E2E quality gates (`npm run test:e2e`) and 33 unit tests must stay green.

---

### Task 1: Bill & Due Date Domain Utilities

**Files:**
- Create: `src/lib/bills.ts`
- Create: `src/lib/bills.test.ts`

**Interfaces:**
- Produces: `calculateDueDays`, `getUpcomingBills`, `UpcomingBill`

- [ ] **Step 1: Write failing unit tests for bill calculation logic**

Create `src/lib/bills.test.ts`:
```typescript
import { calculateDueDays, getUpcomingBills, type UpcomingBill } from './bills';
import type { Account } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Reference date: 19 October 2026
const refDate = new Date(2026, 9, 19); // month index 9 = October

// 1. Due date in current month (25th) -> 6 days left
const due25 = calculateDueDays(25, refDate);
assert(due25.daysLeft === 6, 'Due on 25th should be 6 days left from 19th');
assert(due25.urgency === 'upcoming', '6 days left should be upcoming');

// 2. Due date in 2 days (21st) -> urgent
const due21 = calculateDueDays(21, refDate);
assert(due21.daysLeft === 2, 'Due on 21st should be 2 days left');
assert(due21.urgency === 'urgent', '2 days left should be urgent');

// 3. Due date today (19th) -> urgent (0 days left)
const due19 = calculateDueDays(19, refDate);
assert(due19.daysLeft === 0, 'Due today should be 0 days left');
assert(due19.urgency === 'urgent', '0 days left should be urgent');

// 4. Past due day in current month (e.g. 15th):
// If the account has an outstanding balance, it is overdue
const due15 = calculateDueDays(15, refDate);
assert(due15.daysLeft < 0, '15th from 19th should be negative days left in current month');
assert(due15.urgency === 'overdue', 'Negative days left should be overdue');

// 5. getUpcomingBills filters liability accounts with negative balance and dueDay
const accounts: Account[] = [
  {
    id: 'spaylater',
    name: 'SPayLater',
    kind: 'liability',
    balance: -450000,
    dueDay: 25,
    createdAt: Date.now(),
  },
  {
    id: 'bca',
    name: 'BCA',
    kind: 'asset',
    balance: 5000000,
    createdAt: Date.now(),
  },
  {
    id: 'gopaylater',
    name: 'GoPay Later',
    kind: 'liability',
    balance: 0, // No bill
    dueDay: 20,
    createdAt: Date.now(),
  },
];

const upcoming = getUpcomingBills(accounts, refDate);
assert(upcoming.length === 1, 'Only accounts with outstanding liability should be returned');
assert(upcoming[0].accountId === 'spaylater', 'Account ID should match');
assert(upcoming[0].amount === 450000, 'Bill amount should be 450000');
assert(upcoming[0].daysLeft === 6, 'Days left should be 6');

console.log('bills domain logic unit tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/bills.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/bills.ts`**

Create `src/lib/bills.ts`:
```typescript
import type { Account } from './schemas';

export type BillUrgency = 'overdue' | 'urgent' | 'upcoming' | 'safe';

export interface DueDateCalculation {
  daysLeft: number;
  urgency: BillUrgency;
  dueDate: Date;
}

export interface UpcomingBill {
  accountId: string;
  accountName: string;
  accountIcon?: string;
  amount: number;
  dueDay: number;
  daysLeft: number;
  urgency: BillUrgency;
}

export function calculateDueDays(dueDay: number, referenceDate: Date = new Date()): DueDateCalculation {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  const daysLeft = dueDay - currentDay;
  const dueDate = new Date(year, month, dueDay);

  let urgency: BillUrgency;
  if (daysLeft < 0) {
    urgency = 'overdue';
  } else if (daysLeft <= 3) {
    urgency = 'urgent';
  } else if (daysLeft <= 7) {
    urgency = 'upcoming';
  } else {
    urgency = 'safe';
  }

  return { daysLeft, urgency, dueDate };
}

export function getUpcomingBills(accounts: Account[], referenceDate: Date = new Date()): UpcomingBill[] {
  const result: UpcomingBill[] = [];

  for (const acc of accounts) {
    // Only liability accounts with negative balance and a specified dueDay
    if (acc.kind === 'liability' && acc.dueDay && acc.dueDay >= 1 && acc.dueDay <= 31 && acc.balance < 0) {
      const calc = calculateDueDays(acc.dueDay, referenceDate);
      result.push({
        accountId: acc.id,
        accountName: acc.name,
        accountIcon: acc.icon,
        amount: Math.abs(acc.balance),
        dueDay: acc.dueDay,
        daysLeft: calc.daysLeft,
        urgency: calc.urgency,
      });
    }
  }

  // Sort by urgency and then by days left
  const urgencyWeight: Record<BillUrgency, number> = {
    overdue: 0,
    urgent: 1,
    upcoming: 2,
    safe: 3,
  };

  return result.sort((a, b) => {
    const diff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    if (diff !== 0) return diff;
    return a.daysLeft - b.daysLeft;
  });
}
```

- [ ] **Step 4: Run unit tests**

Run: `bun test src/lib/bills.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/bills.ts src/lib/bills.test.ts
git commit -m "feat(bills): add due date and upcoming bills calculation logic"
```

---

### Task 2: Schema & Account Service Support for `dueDay`

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/features/accounts/accountService.ts`
- Modify: `src/features/accounts/accountService.test.ts`

**Interfaces:**
- Produces: `accountSchema.dueDay`, `UpdateAccountInput.dueDay`, `CreateAccountInput.dueDay`

- [ ] **Step 1: Write test for `dueDay` in `accountService.test.ts`**

Add tests checking:
- `accountSchema` parses valid `dueDay: 25`.
- `sanitizeAccountUpdate` keeps valid `dueDay: 25` and ignores invalid numbers.

- [ ] **Step 2: Update `src/lib/schemas.ts` and `accountService.ts`**

In `src/lib/schemas.ts`:
```typescript
export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['asset', 'liability']),
  balance: z.number().int(),
  icon: z.string().max(8).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int(),
});
```
In `src/features/accounts/accountService.ts`:
Update `CreateAccountInput`, `UpdateAccountInput`, and `sanitizeAccountUpdate` to support `dueDay`.

- [ ] **Step 3: Run unit tests**

Run: `bun test src/features/accounts/accountService.test.ts`
Expected: PASS

- [ ] **Step 4: Commit Task 2**

```bash
git add src/lib/schemas.ts src/features/accounts/accountService.ts src/features/accounts/accountService.test.ts
git commit -m "feat(accounts): support optional dueDay field for liability accounts"
```

---

### Task 3: ManageSheet Due Day Input & List Badge

**Files:**
- Modify: `src/features/manage/ManageSheet.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Renders: Input *"Tanggal Jatuh Tempo Bulanan (1-31)"* when account `kind === 'liability'`.
- Renders: Badge `🗓️ Jatuh tempo tgl 25` on liability account cards.

- [ ] **Step 1: Add `dueDay` field to account form state in `ManageSheet.tsx`**
- Show input only if `kind === 'liability'`.
- Populate when editing account.
- Include in submit payload.
- In account item row, display badge if `acc.dueDay` is set.

- [ ] **Step 2: Add styles in `src/styles/components.css`**
Add styles with zero raw hex:
```css
.account-due-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
```

- [ ] **Step 3: Verify Zero Hex & Commit Task 3**

```bash
git add src/features/manage/ManageSheet.tsx src/styles/components.css
git commit -m "feat(manage): add dueDay input and badge for liability accounts"
```

---

### Task 4: Dashboard UpcomingBillsCard & 1-Click Pay Action

**Files:**
- Create: `src/features/dashboard/UpcomingBillsCard.tsx`
- Modify: `src/features/dashboard/DashboardView.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `getUpcomingBills` from `src/lib/bills`
- Callback: `onPayBill(accountId: string, amount: number)`

- [ ] **Step 1: Create `UpcomingBillsCard.tsx`**
Renders a high-visibility alert banner when there are upcoming or overdue bills:
- Overdue badge: `.bill-badge-overdue` (Rose / Danger).
- Urgent badge (<=3 days): `.bill-badge-urgent` (Amber / Warning).
- Shows account name, bill amount, and countdown ("Jatuh tempo 3 hari lagi").
- Button *"Bayar Sekarang"* triggers `onPayBill(bill.accountId, bill.amount)`.

- [ ] **Step 2: Wire `onPayBill` into `DashboardView.tsx`**
When `onPayBill` is clicked:
- Opens `TransactionFormSheet` with initial values:
  - `type: 'transfer'`
  - `toAccountId: accountId`
  - `rawAmount: formatIdr(amount)`
  - `note: 'Pembayaran tagihan ' + accountName`

- [ ] **Step 3: Add styles in `src/styles/components.css` with zero raw hex**

- [ ] **Step 4: Commit Task 4**

```bash
git add src/features/dashboard/UpcomingBillsCard.tsx src/features/dashboard/DashboardView.tsx src/styles/components.css
git commit -m "feat(dashboard): add UpcomingBillsCard with 1-click settlement transfer"
```

---

### Task 5: Comprehensive Verification & Gate Checks

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
