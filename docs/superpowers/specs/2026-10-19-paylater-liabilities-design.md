# Design Specification: Kantong Akun PayLater & Liabilities Tracking

**Date:** 2026-10-19  
**Status:** Validated & Approved  
**Author:** Pair Programming (Google DeepMind Antigravity + User)

---

## 1. Executive Summary & Goals

In everyday personal and household finances in Indonesia, digital credit products (SPayLater, GoPay Later, Kredivo, Akulaku, Tokopedia PayLater, and Credit Cards) are widely used for purchases. However, users frequently struggle to maintain a clear picture of what money they actually own versus what debts they must repay.

This feature enhances **Kantong Akun (Accounts)** in Catat to first-class support PayLater and debt liabilities:
1. **Multiple PayLater Accounts:** Users can create and manage unlimited PayLater/liability accounts alongside traditional asset accounts (Tunai, Bank, E-Wallet).
2. **Clear Separation of Assets vs Liabilities:** The Kantong Akun UI cleanly differentiates "Aset (Uang Saya)" from "PayLater & Tagihan (Kewajiban)".
3. **Actionable Bill Repayment ("Bayar Tagihan"):** When a PayLater account has an outstanding balance (negative balance resulting from spending), users see an immediate **"Bayar"** action that pre-fills a transfer from their bank or cash account to settle the debt.
4. **Accurate Net Worth (Saldo Bersih):** The dashboard hero card calculates and displays the true net balance (`Total Aset - Total Tagihan PayLater`), with a clear breakdown so users never confuse available cash with unpaid debt.
5. **Seamless Expense Logging:** Logging expenses using a PayLater account naturally accumulates the liability without requiring manual bookkeeping tricks.

---

## 2. Accounting Logic & Data Model

### 2.1 Existing Schema (`accountSchema` in `src/lib/schemas.ts`)
The existing schema already includes the necessary field:
```typescript
export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['asset', 'liability']),
  balance: z.number().int(),
  icon: z.string().max(8).optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int(),
});
```

### 2.2 Balance Mechanics
In Catat's transaction engine (`transactionService.ts`):
- **Expense via PayLater:**
  When spending `Rp 150.000` with `kind: 'liability'` (starting balance `0`), the account balance updates via:
  ```typescript
  newBalance = currentBalance - expenseAmount // 0 - 150.000 = -150.000
  ```
  A negative balance represents **debt owed (tagihan)**.
- **Bill Repayment via Transfer:**
  When paying off the bill (`Rp 150.000` transferred from `BCA` to `SPayLater`):
  - `fromAccount` (BCA): `balance - 150.000`
  - `toAccount` (SPayLater): `balance + 150.000` (`-150.000 + 150.000 = 0`). The bill is settled!

### 2.3 Calculations Helper (`src/lib/accountCalculations.ts`)
To ensure consistent calculations across Dashboard, ManageSheet, and tests:
```typescript
export interface AccountSummary {
  totalAssets: number;        // Sum of all active asset balances
  totalLiabilities: number;   // Sum of all active unpaid debt (absolute value of negative balances in liabilities)
  netBalance: number;         // totalAssets - totalLiabilities
  assetAccounts: Account[];
  liabilityAccounts: Account[];
}

export function calculateAccountSummary(accounts: Account[]): AccountSummary {
  const active = accounts.filter((a) => !a.isArchived);
  const assetAccounts = active.filter((a) => a.kind === 'asset');
  const liabilityAccounts = active.filter((a) => a.kind === 'liability');

  const totalAssets = assetAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalLiabilities = liabilityAccounts.reduce(
    (sum, a) => sum + (a.balance < 0 ? Math.abs(a.balance) : 0),
    0
  );

  return {
    totalAssets,
    totalLiabilities,
    netBalance: totalAssets - totalLiabilities,
    assetAccounts,
    liabilityAccounts,
  };
}
```

---

## 3. UI / UX Design Specifications

### 3.1 Hero Card (Saldo Bersih & Breakdown)
- **Primary Hero Display:**
  - Label: `Saldo Bersih` (or `Total Saldo` if no liabilities exist).
  - Amount: `formatIdr(summary.netBalance)`.
- **Secondary Breakdown Bar (if `totalLiabilities > 0`):**
  - Displays directly beneath the primary balance:
    - `💰 Aset: Rp 5.000.000`
    - `💳 Tagihan: Rp 450.000` (highlighted in soft rose/amber alert token)
  - This informs users instantly of their financial obligations before making spending decisions.

### 3.2 Kantong Akun Section
- Instead of a single flat scroller mixing bank accounts with unpaid PayLater debts, the section provides visual categorization:
  1. **Sub-heading / Tabs:**
     - `Aset (Uang Saya)`
     - `PayLater & Tagihan` (with a badge indicating count of active tagihan, e.g. `2 Tagihan`)
  2. **Asset Cards:**
     - Displays account name, icon, and positive balance in clean typography.
  3. **PayLater Cards:**
     - Distinct visual styling: subtle border accent (`var(--border)` with left-edge indicator or light badge).
     - Account name and icon (e.g. `💳 SPayLater`).
     - **Status Indicator:**
       - If `balance < 0`:
         - Label: `Tagihan:`
         - Nominal: `Rp 350.000` in `var(--destructive)` or `var(--accent-expense)`.
         - Action: **"⚡ Bayar"** button.
       - If `balance >= 0`:
         - Label: `Tidak ada tagihan (Rp 0)` with green check icon `✓`.
  4. **"Bayar" Quick Action:**
     - Clicking **"Bayar"** triggers `onPayBill(paylaterAccount)`:
       - Sets `TransactionFormSheet` mode to `'transfer'`.
       - Automatically selects the user's primary asset account (first non-archived asset with positive balance) as `fromAccountId`.
       - Sets `toAccountId` to `paylaterAccount.id`.
       - Sets `amount` to `Math.abs(paylaterAccount.balance)`.
       - Sets `note` to `Pelunasan ${paylaterAccount.name}`.
       - Opens the sheet immediately so the user only has to verify and tap **Simpan Transfer**.

### 3.3 Manage Accounts (`ManageSheet.tsx`)
- In **Kelola Akun**:
  - Type toggle when creating an account:
    - `Aset` (Kas Tunai, Rekening Bank, Dompet Digital)
    - `PayLater / Tagihan` (SPayLater, GoPay Later, Kredivo, Kartu Kredit, dll)
  - Default icon auto-suggest:
    - Choosing `PayLater` defaults to `💳` if icon is empty.
  - Helpful descriptive caption:
    - *"Pengeluaran dengan akun PayLater akan tercatat sebagai tagihan yang harus dibayar."*
  - List view separates active Assets from active Liabilities, making it crystal clear which accounts are debt vehicles.

---

## 4. Integration with Scanning & OCR

- The OCR parser and `TransactionFormSheet` already support detecting PayLater keywords (`spay`, `shopee paylater`, `paylater`).
- If an OCR receipt shows payment method `SPayLater` or `GoPayLater`:
  - `TransactionFormSheet` matches the corresponding liability account.
  - The expense is attributed to that PayLater account, increasing the outstanding bill.

---

## 5. CSS & Quality Gate Compliance (Gate 12)

- **Zero raw hex colors:** All styles must use existing CSS design tokens:
  - `var(--destructive)` / `var(--accent-expense)` for liability tagihan.
  - `var(--success)` / `var(--income)` for lunas indicator.
  - `var(--card)`, `var(--card-hover)`, `var(--border)` for sheet and chip containers.
- **Touch Accessibility:**
  - All interactive buttons (including the **Bayar** button) must have a minimum interactive tap target of 44px (or adequate padding).
- **Responsive Geometry:**
  - Horizontal scroll or flex wrap adapts smoothly from mobile (`< 480px`) up to desktop.

---

## 6. Verification & Test Plan

1. **Unit Tests (`src/lib/accountCalculations.test.ts`):**
   - Correct sum of assets with positive balances.
   - Correct sum of liabilities with negative balances (debts).
   - Correct net balance calculation (`totalAssets - totalLiabilities`).
   - Correct handling of zero balances and accounts without debt.
2. **Component & Integration Tests:**
   - Verify `TransactionFormSheet` opens in transfer mode with prefilled values when `onPayBill` is triggered.
   - Verify `canArchiveAccount` prevents archiving an account with active unpaid debt if balance is non-zero.
3. **E2E Playwright Suite:**
   - Run full 14 gates suite to ensure no regressions.
   - Verify zero raw hex in `src/styles/components.css`.
