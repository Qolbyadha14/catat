# Design Specification: Header Profile Menu & Comprehensive Accounts/Categories Expansion

**Date:** 2026-10-19  
**Status:** Validated & Approved  
**Author:** Pair Programming (Google DeepMind Antigravity + User)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Header Overflow Bug
Catat's container layout is structured as a centered mobile card (`.app-container` with `max-width: 440px`).
Previously, `.app-header` hosted 5 separate interactive components on the right side:
1. `btn-header-family` (Family Ledger button)
2. `btn-header-gear` (Manage accounts/categories)
3. `theme-toggle-wrap` (Theme picker select)
4. `user-avatar` (User avatar circle)
5. `btn-signout` (Keluar button)

On screens `>= 640px`, the label on `btn-header-family` expands to display "Keluarga". Combined with brand title and subtitle on the left, the header content required > 520px of horizontal space, causing the `[ Keluar ]` button and right edge to poke out and overflow past the card boundary.

### 1.2 The Profile Menu Solution
We consolidate **Pengaturan (Kelola Akun & Kategori)**, **Tema Tampilan**, and **Keluar Akun** into a dedicated **Profile Popover Menu** activated by clicking the User Avatar. The header right-hand side is reduced from 5 cluttered buttons to **2 clean, purposeful elements**:
- `[👥 Keluarga]` / `[👥 Kas Bersama]`
- `(Avatar)` (interactive button with tap target >= 44px)

### 1.3 Comprehensive Indonesian Accounts & Categories
New user onboarding currently only provides 2 accounts without icons (`Tunai` and `Rekening Utama`) and 8 basic categories. Real-world financial tracking in Indonesian households and OCR receipt scanning require:
- **E-Wallet** (GoPay, OVO, ShopeePay, DANA)
- **PayLater** (SPayLater, GoPay Later)
- **Belanja Dapur / Sembako** (groceries at Alfamart/Indomaret/supermarkets separated from general shopping)
- **Pendidikan & Anak** (school tuition, supplies)
- **Donasi & Sedekah** (zakat, infaq, social giving)
- **Usaha & Penjualan** and **Bonus & THR** (income streams beyond basic salary)
- **Quick Preset Chips** in `ManageSheet` for rapid 1-tap account and category creation.

---

## 2. UI / UX Design Specifications

### 2.1 Header Refactoring
```
+-------------------------------------------------------------+
| Catat [COREBOY]                 [👥 Kas Bersama]  ( QO )    |
| Your money, under control.                                  |
+-------------------------------------------------------------+
```
- Available width inside header: `400px` (440px - 2 * 20px padding).
- Brand group width: ~140px.
- Right menu width:
  - `btn-header-family`: max ~110px on desktop, 44px on mobile.
  - Gap: 8px.
  - `btn-header-avatar`: 40px (min touch target 44px with padding/hit-area).
  - Total right menu width: max 158px.
  - Total header occupancy: 140px + 158px + 16px buffer = 314px < 400px.
  - **Zero overflow guaranteed** across all viewports!

### 2.2 Profile Popover Menu
Clicking `(Avatar)` opens a floating popover anchored beneath the avatar with a subtle click-outside backdrop:
- **Profile Header:**
  - Avatar badge (44px) with user initial / photoURL
  - User name (`user.displayName` or email handle)
  - User email in `var(--muted-foreground)`
- **Menu Actions:**
  - ⚙️ **Kelola Akun & Kategori** (opens `ManageSheet`)
  - 🌓 **Tema Tampilan** (clean segmented toggle or select: Sistem, Terang, Gelap)
  - 🚪 **Keluar Akun** (Sign Out with soft destructive token)
- **Keyboard & Accessibility:**
  - Accessible via `Escape` key to close.
  - Click-outside dismisses the menu automatically.
  - All interactive items have >= 44px height.

---

## 3. Data Model & Defaults Expansion

### 3.1 Updated `DEFAULT_ACCOUNTS` (`src/features/auth/seedDefaults.ts`)
```typescript
const DEFAULT_ACCOUNTS: Omit<SeedAccount, 'createdAt'>[] = [
  { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 0, icon: '💵', isArchived: false },
  { id: 'acc_bank', name: 'Rekening Utama', kind: 'asset', balance: 0, icon: '🏦', isArchived: false },
  { id: 'acc_ewallet', name: 'Dompet Digital', kind: 'asset', balance: 0, icon: '📱', isArchived: false },
  { id: 'acc_paylater', name: 'SPayLater', kind: 'liability', balance: 0, icon: '💳', isArchived: false },
];
```

### 3.2 Updated `DEFAULT_CATEGORIES` (`src/features/auth/seedDefaults.ts`)
```typescript
const DEFAULT_CATEGORIES: Omit<SeedCategory, 'createdAt'>[] = [
  // Expense
  { id: 'cat_groceries', name: 'Sembako & Dapur', type: 'expense', icon: '🥦', isArchived: false },
  { id: 'cat_food', name: 'Makan & Minum', type: 'expense', icon: '🍔', isArchived: false },
  { id: 'cat_transport', name: 'Transportasi', type: 'expense', icon: '🚗', isArchived: false },
  { id: 'cat_shopping', name: 'Belanja & Olshop', type: 'expense', icon: '🛍️', isArchived: false },
  { id: 'cat_bills', name: 'Tagihan & Utilitas', type: 'expense', icon: '💡', isArchived: false },
  { id: 'cat_education', name: 'Pendidikan & Anak', type: 'expense', icon: '📚', isArchived: false },
  { id: 'cat_health', name: 'Kesehatan', type: 'expense', icon: '💊', isArchived: false },
  { id: 'cat_entertainment', name: 'Hiburan', type: 'expense', icon: '🎬', isArchived: false },
  { id: 'cat_charity', name: 'Donasi & Sedekah', type: 'expense', icon: '🤲', isArchived: false },
  { id: 'cat_installment', name: 'Cicilan & Hutang', type: 'expense', icon: '💳', isArchived: false },
  // Income
  { id: 'cat_salary', name: 'Gaji Utama', type: 'income', icon: '💰', isArchived: false },
  { id: 'cat_business', name: 'Usaha & Jualan', type: 'income', icon: '💼', isArchived: false },
  { id: 'cat_bonus', name: 'Bonus & THR', type: 'income', icon: '🎁', isArchived: false },
  { id: 'cat_other_income', name: 'Pemasukan Lain', type: 'income', icon: '📈', isArchived: false },
];
```

### 3.3 Quick Presets in `ManageSheet.tsx`
When creating an account or category, provide quick chips to auto-fill name, icon, and kind:
- **Account Presets:**
  - `🏦 BCA` (asset, 🏦)
  - `🏦 Mandiri` (asset, 🏦)
  - `🏦 BRI` (asset, 🏦)
  - `🏦 Jago` (asset, 🏦)
  - `📱 GoPay` (asset, 📱)
  - `📱 ShopeePay` (asset, 📱)
  - `📱 OVO` (asset, 📱)
  - `💳 SPayLater` (liability, 💳)
  - `💳 GoPay Later` (liability, 💳)
  - `💳 Kredivo` (liability, 💳)

---

## 4. Quality Gate & CSS Compliance (Gate 12)

- **Zero Raw Hex Colors:** All CSS rules in `src/styles/components.css` use semantic design tokens:
  - `var(--card)`, `var(--popover)`, `var(--border)`, `var(--muted-foreground)`, `var(--error-fg)`, `var(--surface-secondary)`, etc.
- **Touch Target Accessibility:** All buttons and interactive rows have a minimum 44px tap height or equivalent padding.
- **No Regression in E2E Gates:** Seed idempotent test (Gate 6) and other gates must pass with 100% green status.
