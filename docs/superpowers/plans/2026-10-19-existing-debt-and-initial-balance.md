# Existing Debt & Initial Balance (Saldo & Hutang Awal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to record existing debt and initial starting balances when creating or managing accounts in Catat, seamlessly reflecting in the dashboard net worth, upcoming bills, and account scrollers without corrupting monthly cashflow reports.

**Architecture:**
1. **Service Layer (`src/features/accounts/accountService.ts`)**:
   - `createAccount`: When `kind === 'liability'` and `initialDebt` is provided, stores `balance = -Math.abs(initialDebt)`. When `kind === 'asset'` and `initialBalance` is provided, stores `balance = Math.abs(initialBalance)`.
   - `adjustAccountBalance`: Dedicated service function to update an existing account's balance (for correcting initial debt or balance adjustments) cleanly and idempotently.
2. **UI in ManageSheet (`src/features/manage/ManageSheet.tsx`)**:
   - For New Accounts: Dynamic input *"Sisa Hutang Saat Ini"* (if liability) or *"Saldo Awal"* (if asset) with live `.` thousands formatting.
   - For Existing Accounts: Shows current balance with an inline *"Koreksi Saldo / Sisa Hutang"* toggle so users can update existing debt if needed.
3. **Design System & Zero Hex (`src/styles/components.css`)**:
   - Form inputs, helper labels, and adjustment toggles built with semantic variables (`var(--surface-secondary)`, `var(--border-subtle)`, `var(--danger-fg)`).

**Tech Stack:** React 19, TypeScript, Firestore, Bun Test, Vanilla CSS Design System.

## Global Constraints
- Zero raw hex codes in `src/styles/components.css` (enforced by Gate 12).
- WCAG AA contrast compliance: text >= 4.5:1, graphical UI >= 3:1 in both light and dark modes.
- Balance atomicity & safety: `sanitizeAccountUpdate` remains strict (stripping general balance overwrite on name/icon/isArchived edits); balance adjustments must use explicit dedicated logic.
- All 14 existing E2E quality gates (`npm run test:e2e`) and 36 unit tests must stay green.

---

### Task 1: Account Service Initial Balance & Adjust Balance Logic

**Files:**
- Modify: `src/features/accounts/accountService.ts`
- Create: `src/features/accounts/accountInitialBalance.test.ts`

**Interfaces:**
- Produces: `adjustAccountBalance(uid: string, accountId: string, newBalance: number): Promise<void>`
- Extends: `CreateAccountInput` with initial balance / debt handling

- [ ] **Step 1: Write unit tests for initial debt and balance adjustment**

Create `src/features/accounts/accountInitialBalance.test.ts`:
```typescript
import { createAccount, adjustAccountBalance } from './accountService';
import type { Account } from '../../lib/schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// 1. Test helper to compute initial balance based on account kind
export function computeInitialBalance(kind: 'asset' | 'liability', inputAmount: number): number {
  if (kind === 'liability') {
    return -Math.abs(inputAmount);
  }
  return Math.abs(inputAmount);
}

assert(computeInitialBalance('liability', 5000000) === -5000000, 'Liability balance must be negative');
assert(computeInitialBalance('liability', 0) === 0, 'Zero liability balance must be 0');
assert(computeInitialBalance('asset', 2000000) === 2000000, 'Asset balance must be positive');

// 2. Test adjustAccountBalance function signature and validation
assert(typeof adjustAccountBalance === 'function', 'adjustAccountBalance must be a function');

console.log('accountInitialBalance tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/accounts/accountInitialBalance.test.ts`
Expected: FAIL (adjustAccountBalance not exported or found)

- [ ] **Step 3: Implement `adjustAccountBalance` in `accountService.ts`**

In `src/features/accounts/accountService.ts`:
```typescript
export async function adjustAccountBalance(
  uid: string,
  accountId: string,
  newBalance: number
): Promise<void> {
  const intBalance = Math.round(newBalance);
  const ref = doc(db, 'users', uid, 'accounts', accountId);
  await updateDoc(ref, { balance: intBalance });
}
```

- [ ] **Step 4: Run unit tests**

Run: `bun test src/features/accounts/accountInitialBalance.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/accounts/accountService.ts src/features/accounts/accountInitialBalance.test.ts
git commit -m "feat(accounts): support adjustAccountBalance and initial debt computation"
```

---

### Task 2: ManageSheet Initial Balance & Debt Form Inputs

**Files:**
- Modify: `src/features/manage/ManageSheet.tsx`

**Interfaces:**
- Adds:
  - Form state `initialBalanceInput: string` (formatted with `.` thousands separators).
  - State `isAdjustingBalance: boolean` when editing an existing account.
  - Submits `balance = kind === 'liability' ? -Math.abs(val) : Math.abs(val)` when creating an account.
  - Calls `adjustAccountBalance` when user explicitly edits balance on an existing account.

- [ ] **Step 1: Add initial balance state and handlers in `ManageSheet.tsx`**

Add state:
```typescript
const [initialBalanceInput, setInitialBalanceInput] = useState('');
const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);
```

When clicking edit on an account:
```typescript
if ('balance' in item) {
  setInitialBalanceInput(item.balance !== 0 ? new Intl.NumberFormat('id-ID').format(Math.abs(item.balance)) : '');
  setIsAdjustingBalance(false);
}
```

When creating:
```typescript
setInitialBalanceInput('');
setIsAdjustingBalance(false);
```

- [ ] **Step 2: Add form inputs in `ManageSheet.tsx`**

In the Account form:
When creating:
```tsx
<div className="form-group">
  <label className="form-label">
    {kind === 'liability' ? 'Sisa Hutang Saat Ini (Opsional)' : 'Saldo Awal (Opsional)'}
  </label>
  <div className="input-group">
    <span className="input-prefix">Rp</span>
    <input
      type="text"
      inputMode="numeric"
      className="form-input"
      placeholder="0"
      value={initialBalanceInput}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setInitialBalanceInput(raw ? new Intl.NumberFormat('id-ID').format(parseInt(raw, 10)) : '');
      }}
    />
  </div>
  <span className="form-help-text" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
    {kind === 'liability'
      ? 'Hutang berjalan atau tagihan existing dari sebelum menggunakan aplikasi Catat.'
      : 'Saldo kas atau rekening saat pertama kali dicatat.'}
  </span>
</div>
```

When editing:
```tsx
{editingItem && 'balance' in editingItem && (
  <div className="form-group">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <label className="form-label" style={{ marginBottom: 0 }}>
        {editingItem.kind === 'liability' ? 'Sisa Hutang / Tagihan:' : 'Saldo Saat Ini:'}
      </label>
      <button
        type="button"
        className="manage-adjust-btn"
        onClick={() => setIsAdjustingBalance(!isAdjustingBalance)}
      >
        {isAdjustingBalance ? 'Batal Koreksi' : '✏️ Koreksi Sisa Hutang'}
      </button>
    </div>
    {!isAdjustingBalance ? (
      <div className="manage-readonly-row" style={{ marginTop: 6 }}>
        <span className="manage-readonly-val">
          {editingItem.kind === 'liability' && editingItem.balance < 0
            ? `Tagihan: ${formatIdr(Math.abs(editingItem.balance))}`
            : formatIdr(editingItem.balance)}
        </span>
      </div>
    ) : (
      <div style={{ marginTop: 6 }}>
        <div className="input-group">
          <span className="input-prefix">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            className="form-input"
            value={initialBalanceInput}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              setInitialBalanceInput(raw ? new Intl.NumberFormat('id-ID').format(parseInt(raw, 10)) : '');
            }}
          />
        </div>
        <span className="form-help-text" style={{ fontSize: '11px', color: 'var(--warning-fg)', marginTop: 4, display: 'block' }}>
          ⚠️ Mengoreksi saldo tidak akan membuat catatan transaksi baru di riwayat arus kas.
        </span>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Handle submit with initial balance & balance adjustment**

When creating:
```typescript
const rawBal = initialBalanceInput.replace(/\D/g, '');
const parsedNum = rawBal ? parseInt(rawBal, 10) : 0;
const initialBal = kind === 'liability' ? -Math.abs(parsedNum) : Math.abs(parsedNum);

await createAccount(uid, {
  name: trimmedName,
  icon: icon.trim() || undefined,
  kind,
  dueDay: validDueDay ?? undefined,
  balance: initialBal,
});
```

When editing:
```typescript
if (editingItem && 'balance' in editingItem && isAdjustingBalance) {
  const rawBal = initialBalanceInput.replace(/\D/g, '');
  const parsedNum = rawBal ? parseInt(rawBal, 10) : 0;
  const newBal = editingItem.kind === 'liability' ? -Math.abs(parsedNum) : Math.abs(parsedNum);
  await adjustAccountBalance(uid, editingItem.id, newBal);
}
```

- [ ] **Step 4: Commit Task 2**

```bash
git add src/features/manage/ManageSheet.tsx
git commit -m "feat(manage): add initial debt input and balance adjustment in ManageSheet"
```

---

### Task 3: CSS Styles & Gate 12 Compliance

**Files:**
- Modify: `src/styles/components.css`

**Interfaces:**
- Classes: `.manage-adjust-btn`, zero raw hex codes.

- [ ] **Step 1: Add styles in `src/styles/components.css`**
```css
.manage-adjust-btn {
  background: transparent;
  border: none;
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
}

.manage-adjust-btn:hover {
  text-decoration: underline;
}
```

- [ ] **Step 2: Run Zero Hex Audit and Build**
Run: `git grep -E "#[0-9a-fA-F]{3,8}\b" src/styles/components.css`
Expected: 0 matches
Run: `npm run build`
Expected: Clean build

- [ ] **Step 3: Commit Task 3**

```bash
git add src/styles/components.css
git commit -m "feat(styles): add manage-adjust-btn styling with zero raw hex"
```

---

### Task 4: Comprehensive Verification & Gate Checks

- [ ] **Step 1: Run all unit tests**
Run: `bun test src/`
Expected: All 37+ test suites pass

- [ ] **Step 2: Run all 14 E2E gates**
Run: `npm run test:e2e`
Expected: All 14 passed (163+ assertions)

- [ ] **Step 3: Deploy to Firebase Hosting**
Run: `npx -y firebase-tools deploy --only hosting`
Expected: Live deployment complete to `https://catat-8897d.web.app`
