# Kantong Akun PayLater & Liabilities Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement PayLater & debt liabilities tracking in "Kantong Akun" with separated visual sections, outstanding bill indicator, instant 1-click "Bayar Tagihan" transfer flow, and accurate Net Worth (Saldo Bersih) hero card breakdown.

**Architecture:** Utilize existing `kind: 'asset' | 'liability'` in `Account` schema. Negative balances on liability accounts represent accrued debt from expenses. A pure helper module `accountCalculations.ts` calculates assets, debt, and net balance. DashboardView separates assets from liabilities in the scroller, displays a debt breakdown in the Hero Card, and wires a "Bayar Tagihan" button that opens `TransactionFormSheet` in prefilled transfer mode. `ManageSheet` clarifies account type creation with presets and grouping.

**Tech Stack:** React 19, TypeScript, Firebase Firestore, Bun Test (unit tests), Playwright (E2E), Vanilla CSS with design tokens (Gate 12 compliant, zero raw hex).

## Global Constraints

- Zero raw hex colors in `src/styles/components.css` (enforced by Gate 12).
- Zero breaking changes to `accountSchema` or existing Firestore records.
- Support multiple PayLater accounts concurrently (SPayLater, GoPay Later, Kredivo, etc.).
- All interactive buttons must have minimum tap target of 44x44px or adequate touch padding.
- All unit tests (`bun test src/`) and E2E gates (`npm run test:e2e`) must pass with zero errors.

---

### Task 1: Account Calculations Helper & Unit Tests

**Files:**
- Create: `src/lib/accountCalculations.ts`
- Create: `src/lib/accountCalculations.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AccountSummary {
    totalAssets: number;
    totalLiabilities: number;
    netBalance: number;
    assetAccounts: Account[];
    liabilityAccounts: Account[];
    hasLiabilities: boolean;
  }
  export function calculateAccountSummary(accounts: Account[]): AccountSummary;
  export function getAccountDebt(account: Account): number;
  ```

- [ ] **Step 1: Write the failing unit tests**

Create `src/lib/accountCalculations.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';
import { calculateAccountSummary, getAccountDebt } from './accountCalculations';
import type { Account } from './schemas';

describe('accountCalculations', () => {
  const accounts: Account[] = [
    { id: '1', name: 'Kas', kind: 'asset', balance: 500000, isArchived: false, createdAt: 1 },
    { id: '2', name: 'BCA', kind: 'asset', balance: 2500000, isArchived: false, createdAt: 2 },
    { id: '3', name: 'SPayLater', kind: 'liability', balance: -450000, isArchived: false, createdAt: 3 },
    { id: '4', name: 'GoPay Later', kind: 'liability', balance: 0, isArchived: false, createdAt: 4 },
    { id: '5', name: 'Old Account', kind: 'asset', balance: 100000, isArchived: true, createdAt: 5 },
  ];

  it('calculates getAccountDebt correctly', () => {
    expect(getAccountDebt(accounts[2]!)).toBe(450000);
    expect(getAccountDebt(accounts[3]!)).toBe(0);
    expect(getAccountDebt(accounts[0]!)).toBe(0);
  });

  it('calculates summary excluding archived accounts', () => {
    const summary = calculateAccountSummary(accounts);
    expect(summary.totalAssets).toBe(3000000); // 500k + 2.5m (excludes archived 100k)
    expect(summary.totalLiabilities).toBe(450000);
    expect(summary.netBalance).toBe(2550000); // 3m - 450k
    expect(summary.assetAccounts.length).toBe(2);
    expect(summary.liabilityAccounts.length).toBe(2);
    expect(summary.hasLiabilities).toBe(true);
  });

  it('handles accounts with zero liabilities', () => {
    const assetOnly: Account[] = [
      { id: '1', name: 'Kas', kind: 'asset', balance: 100000, isArchived: false, createdAt: 1 },
    ];
    const summary = calculateAccountSummary(assetOnly);
    expect(summary.totalAssets).toBe(100000);
    expect(summary.totalLiabilities).toBe(0);
    expect(summary.netBalance).toBe(100000);
    expect(summary.hasLiabilities).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/accountCalculations.test.ts`
Expected: FAIL (Cannot find module './accountCalculations')

- [ ] **Step 3: Implement `src/lib/accountCalculations.ts`**

```typescript
import type { Account } from './schemas';

export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netBalance: number;
  assetAccounts: Account[];
  liabilityAccounts: Account[];
  hasLiabilities: boolean;
}

export function getAccountDebt(account: Account): number {
  if (account.kind !== 'liability') return 0;
  return account.balance < 0 ? Math.abs(account.balance) : 0;
}

export function calculateAccountSummary(accounts: Account[]): AccountSummary {
  const active = accounts.filter((a) => !a.isArchived);
  const assetAccounts = active.filter((a) => a.kind === 'asset');
  const liabilityAccounts = active.filter((a) => a.kind === 'liability');

  const totalAssets = assetAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalLiabilities = liabilityAccounts.reduce(
    (sum, a) => sum + getAccountDebt(a),
    0
  );

  return {
    totalAssets,
    totalLiabilities,
    netBalance: totalAssets - totalLiabilities,
    assetAccounts,
    liabilityAccounts,
    hasLiabilities: liabilityAccounts.length > 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/accountCalculations.test.ts`
Expected: PASS (all 3 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/accountCalculations.ts src/lib/accountCalculations.test.ts
git commit -m "feat(accounts): add account calculations helper for assets and liabilities"
```

---

### Task 2: Update `TransactionFormSheet` with `initialTransfer` Prop for Quick Bill Repayment

**Files:**
- Modify: `src/features/transactions/TransactionFormSheet.tsx`

**Interfaces:**
- Consumes: `Account` from `src/lib/schemas.ts`
- Produces: `initialTransfer?: { fromAccountId: string; toAccountId: string; amount: number; note: string }` prop on `TransactionFormSheetProps`.

- [ ] **Step 1: Check existing initialData / props in `TransactionFormSheet.tsx`**

View `TransactionFormSheetProps` in `src/features/transactions/TransactionFormSheet.tsx:15-35`.
Notice `duplicateData?: DuplicateFormValues | null`.
Add `initialTransfer?: { fromAccountId: string; toAccountId: string; amount: number; note: string } | null` to `TransactionFormSheetProps`.

- [ ] **Step 2: Update `TransactionFormSheet.tsx` to handle `initialTransfer`**

When `initialTransfer` is provided:
- Default `activeType` state to `'transfer'`.
- Default `fromAccountId` to `initialTransfer.fromAccountId`.
- Default `toAccountId` to `initialTransfer.toAccountId`.
- Default `amount` to `String(initialTransfer.amount)`.
- Default `note` to `initialTransfer.note`.
- When form opens or `initialTransfer` changes via `useEffect`, update form fields.

- [ ] **Step 3: Run existing transaction unit tests**

Run: `bun test src/features/transactions/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/transactions/TransactionFormSheet.tsx
git commit -m "feat(transactions): support initialTransfer prefill in TransactionFormSheet"
```

---

### Task 3: Dashboard Hero Card & Kantong Akun UI with PayLater Separation and Quick "Bayar"

**Files:**
- Modify: `src/features/dashboard/DashboardView.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `calculateAccountSummary`, `getAccountDebt` from `src/lib/accountCalculations.ts`
- Produces:
  - Hero Card displaying `Saldo Bersih` and secondary breakdown if liabilities exist:
    `💰 Aset: Rp X` | `💳 Tagihan: Rp Y`
  - Kantong Akun section with two sub-groups:
    - **Aset (Uang Saya)**
    - **PayLater & Tagihan** with badge `Tagihan: Rp X` and `⚡ Bayar` button (triggers `onPayBill`)

- [ ] **Step 1: Update `DashboardView.tsx` calculations**

Replace flat `totalBalance = activeAccounts.reduce((acc, a) => acc + a.balance, 0)` with:
```typescript
const accountSummary = useMemo(() => calculateAccountSummary(accounts), [accounts]);
```
Hero card balance displays `formatIdr(accountSummary.netBalance)`.
Hero card label: `accountSummary.hasLiabilities ? 'Saldo Bersih' : 'Total Saldo'`.

If `accountSummary.totalLiabilities > 0`, render secondary hero stats:
```tsx
<div className="hero-liabilities-breakdown">
  <span className="hero-breakdown-item">
    <span className="hero-breakdown-label">💰 Total Aset:</span> {formatIdr(accountSummary.totalAssets)}
  </span>
  <span className="hero-breakdown-divider">•</span>
  <span className="hero-breakdown-item text-danger">
    <span className="hero-breakdown-label">💳 Tagihan PayLater:</span> {formatIdr(accountSummary.totalLiabilities)}
  </span>
</div>
```

- [ ] **Step 2: Add `handlePayBill` handler in `DashboardView.tsx`**

```typescript
const [transferPrefill, setTransferPrefill] = useState<{
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note: string;
} | null>(null);

const handlePayBill = (liabilityAccount: Account) => {
  const debt = getAccountDebt(liabilityAccount);
  const primaryAsset = accountSummary.assetAccounts.find((a) => a.balance > 0) || accountSummary.assetAccounts[0];
  if (!primaryAsset) {
    alert('Tidak ada akun aset/bank untuk membayar tagihan. Tambahkan akun kas/bank terlebih dahulu.');
    return;
  }
  setEditingTx(null);
  setDuplicateData(null);
  setTransferPrefill({
    fromAccountId: primaryAsset.id,
    toAccountId: liabilityAccount.id,
    amount: debt,
    note: `Pelunasan ${liabilityAccount.name}`,
  });
  setIsSheetOpen(true);
};
```

Pass `initialTransfer={transferPrefill}` to `TransactionFormSheet`. Clear `transferPrefill` when closing sheet.

- [ ] **Step 3: Render Kantong Akun Section with Visual Separation**

Replace flat accounts scroller in `DashboardView.tsx`:
```tsx
{/* Accounts Section */}
<section className="accounts-dashboard-section">
  <div className="section-header" style={{ marginBottom: 10 }}>
    <span className="section-title">Kantong Akun</span>
    {accountSummary.liabilityAccounts.length > 0 && (
      <span className="accounts-summary-tag">
        {accountSummary.assetAccounts.length} Aset • {accountSummary.liabilityAccounts.length} PayLater
      </span>
    )}
  </div>

  {/* Aset Sub-Group */}
  <div className="accounts-group-block">
    <div className="accounts-group-label">
      <span>💰 Uang Saya (Aset)</span>
      <span className="accounts-group-total">{formatIdr(accountSummary.totalAssets)}</span>
    </div>
    <div className="accounts-scroller">
      {accountSummary.assetAccounts.map((acc) => (
        <div key={acc.id} className="account-chip">
          <div className="account-chip-icon">{acc.icon || '🏦'}</div>
          <div className="account-chip-info">
            <div className="account-chip-name">{acc.name}</div>
            <div className="account-chip-balance">{formatIdr(acc.balance)}</div>
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* PayLater & Tagihan Sub-Group (if user has liability accounts) */}
  {accountSummary.liabilityAccounts.length > 0 && (
    <div className="accounts-group-block liability-group">
      <div className="accounts-group-label">
        <span>💳 PayLater & Tagihan</span>
        {accountSummary.totalLiabilities > 0 ? (
          <span className="accounts-group-total liability-total">
            Tagihan: {formatIdr(accountSummary.totalLiabilities)}
          </span>
        ) : (
          <span className="accounts-group-total lunas-total">✓ Semua Lunas</span>
        )}
      </div>
      <div className="accounts-scroller">
        {accountSummary.liabilityAccounts.map((acc) => {
          const debt = getAccountDebt(acc);
          return (
            <div key={acc.id} className={`account-chip liability-chip ${debt > 0 ? 'has-debt' : 'is-settled'}`}>
              <div className="account-chip-icon">{acc.icon || '💳'}</div>
              <div className="account-chip-info">
                <div className="account-chip-name">{acc.name}</div>
                <div className="account-chip-balance">
                  {debt > 0 ? (
                    <span className="tagihan-badge">Tagihan: {formatIdr(debt)}</span>
                  ) : (
                    <span className="lunas-badge">✓ Rp 0 (Lunas)</span>
                  )}
                </div>
              </div>
              {debt > 0 && (
                <button
                  type="button"
                  className="btn-pay-tagihan"
                  onClick={() => handlePayBill(acc)}
                  title={`Bayar tagihan ${acc.name}`}
                  aria-label={`Bayar tagihan ${acc.name}`}
                >
                  ⚡ Bayar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  )}
</section>
```

- [ ] **Step 4: Add CSS styles in `src/styles/components.css` (Gate 12 Compliant, 0 Raw Hex)**

```css
/* Hero liabilities breakdown */
.hero-liabilities-breakdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--muted-foreground);
  flex-wrap: wrap;
}

.hero-breakdown-item.text-danger {
  color: var(--destructive);
  font-weight: 600;
}

.hero-breakdown-divider {
  opacity: 0.4;
}

/* Accounts Group Blocks */
.accounts-dashboard-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.accounts-summary-tag {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  background: var(--muted);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.accounts-group-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.accounts-group-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted-foreground);
  padding: 0 2px;
}

.accounts-group-total {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--foreground);
}

.accounts-group-total.liability-total {
  color: var(--destructive);
}

.accounts-group-total.lunas-total {
  color: var(--success);
}

.account-chip.liability-chip {
  border: 1px solid var(--border);
  position: relative;
  min-width: 160px;
}

.account-chip.liability-chip.has-debt {
  border-color: color-mix(in srgb, var(--destructive) 40%, var(--border));
  background: color-mix(in srgb, var(--destructive) 6%, var(--card));
}

.account-chip.liability-chip.is-settled {
  border-color: color-mix(in srgb, var(--success) 30%, var(--border));
}

.tagihan-badge {
  color: var(--destructive);
  font-weight: 600;
}

.lunas-badge {
  color: var(--success);
  font-weight: 500;
}

.btn-pay-tagihan {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  min-width: 44px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-left: 6px;
  transition: opacity 0.15s ease;
}

.btn-pay-tagihan:hover {
  opacity: 0.9;
}
```

- [ ] **Step 5: Run unit tests to verify no regressions**

Run: `bun test src/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/DashboardView.tsx src/styles/components.css
git commit -m "feat(dashboard): add separated paylater accounts scroller with bill repayment"
```

---

### Task 4: Enhance `ManageSheet` for Intuitive PayLater Account Creation

**Files:**
- Modify: `src/features/manage/ManageSheet.tsx`

**Interfaces:**
- Consumes: `Account` from `src/lib/schemas.ts`
- Produces: Enhanced account creation modal with explicit PayLater preset options and icon auto-suggestion.

- [ ] **Step 1: Improve type selection & descriptions in `ManageSheet.tsx`**

In the account form:
```tsx
{isCreating && activeTab === 'accounts' && (
  <div className="form-group">
    <label className="form-label">Tipe Akun</label>
    <select
      className="form-select"
      value={kind}
      onChange={(e) => {
        const selected = e.target.value as 'asset' | 'liability';
        setKind(selected);
        if (selected === 'liability' && !icon) {
          setIcon('💳');
        }
      }}
    >
      <option value="asset">🏦 Aset (Kas Tunai, Rekening Bank, Dompet Digital)</option>
      <option value="liability">💳 PayLater & Tagihan (SPayLater, GoPay Later, Kredivo, dll)</option>
    </select>
    <span className="form-help-text" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 4 }}>
      {kind === 'liability'
        ? 'Pengeluaran via akun ini akan otomatis tercatat sebagai tagihan hutang yang harus dibayar.'
        : 'Akun kas dan tabungan yang siap dibelanjakan.'}
    </span>
  </div>
)}
```

- [ ] **Step 2: Group accounts in `ManageSheet.tsx` list view**

Display active accounts grouped or badged:
- `acc.kind === 'liability'`: badge `💳 PayLater`
- `acc.kind === 'asset'`: badge `🏦 Aset`
Ensure balance shows `Tagihan: Rp X` if liability and balance < 0.

- [ ] **Step 3: Run unit tests**

Run: `bun test src/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/manage/ManageSheet.tsx
git commit -m "feat(manage): enhance paylater account creation and badging in ManageSheet"
```

---

### Task 5: End-to-End Quality Gates Verification & Deployment

**Files:**
- Modify: `src/styles/components.css` (if any hex adjustments needed for Gate 12)
- Test: `npm run test:e2e`

- [ ] **Step 1: Verify Gate 12 (Zero Raw Hex)**

Run: `grep -iE '#[0-9a-fA-F]{3,8}' src/styles/components.css`
Expected: 0 matches

- [ ] **Step 2: Run all 28+ unit test suites**

Run: `bun test src/`
Expected: PASS with 100% test success

- [ ] **Step 3: Run full 14 E2E gates**

Run: `npm run test:e2e`
Expected: 14/14 gates passed

- [ ] **Step 4: Build production bundle**

Run: `npm run build`
Expected: Clean build with 0 TypeScript errors

- [ ] **Step 5: Deploy to Firebase Hosting**

Run: `npx -y firebase-tools@latest deploy --only hosting`
Expected: Live deployment on `https://catat-8897d.web.app`

- [ ] **Step 6: Commit all remaining changes**

```bash
git add .
git commit -m "feat(accounts): complete paylater tracking and bill repayment workflow"
```
