# Implementation Plan: Header Profile Menu & Accounts/Categories Expansion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate header overflow on mobile and desktop by consolidating settings, theme, and sign out into a clean Profile Menu popover, expand default accounts (adding E-Wallet & PayLater) and categories (Groceries, Education, Charity, Business, Bonus), and provide 1-tap quick presets in ManageSheet.

**Architecture:** Create `ProfileMenuPopover` component triggered from the user avatar in `DashboardView.tsx`. Update `seedDefaults.ts` with comprehensive defaults and update `ManageSheet.tsx` with preset chips. Ensure 100% Gate 12 compliance (zero raw hex) and verified E2E quality gates.

**Tech Stack:** React 19, TypeScript, Firebase Firestore & Auth, Playwright, Bun Test, Vanilla CSS with design tokens.

## Global Constraints

- Zero raw hex colors in `src/styles/components.css` (enforced by Gate 12).
- Zero breaking changes to `accountSchema` or existing Firestore records.
- All interactive buttons must have minimum tap target of 44x44px.
- All unit tests (`bun test src/`) and E2E gates (`npm run test:e2e`) must pass with zero errors.

---

### Task 1: Expand Default Accounts and Categories in `seedDefaults.ts`

**Files:**
- Modify: `src/features/auth/seedDefaults.ts`
- Test: `tests/e2e-gates.test.ts` (Gate 6) and `bun test src/`

- [ ] **Step 1: Update `DEFAULT_ACCOUNTS` and `DEFAULT_CATEGORIES` in `seedDefaults.ts`**

Add icons and missing accounts/categories:
```typescript
const DEFAULT_ACCOUNTS: Omit<SeedAccount, 'createdAt'>[] = [
  { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 0, icon: '💵', isArchived: false },
  { id: 'acc_bank', name: 'Rekening Utama', kind: 'asset', balance: 0, icon: '🏦', isArchived: false },
  { id: 'acc_ewallet', name: 'Dompet Digital', kind: 'asset', balance: 0, icon: '📱', isArchived: false },
  { id: 'acc_paylater', name: 'SPayLater', kind: 'liability', balance: 0, icon: '💳', isArchived: false },
];

const DEFAULT_CATEGORIES: Omit<SeedCategory, 'createdAt'>[] = [
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
  { id: 'cat_salary', name: 'Gaji Utama', type: 'income', icon: '💰', isArchived: false },
  { id: 'cat_business', name: 'Usaha & Jualan', type: 'income', icon: '💼', isArchived: false },
  { id: 'cat_bonus', name: 'Bonus & THR', type: 'income', icon: '🎁', isArchived: false },
  { id: 'cat_other_income', name: 'Pemasukan Lain', type: 'income', icon: '📈', isArchived: false },
];
```

- [ ] **Step 2: Run unit and E2E tests to verify seed idempotency**

Run: `bun test src/` and `npm run test:e2e`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/seedDefaults.ts tests/
git commit -m "feat(seed): expand default accounts with e-wallet/paylater and rich categories"
```

---

### Task 2: Create `ProfileMenuPopover` Component

**Files:**
- Create: `src/features/dashboard/ProfileMenuPopover.tsx`

**Interfaces:**
- Produces:
  ```typescript
  interface ProfileMenuPopoverProps {
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onOpenManage: () => void;
    onSignOut: () => Promise<void>;
    theme: ThemeMode;
    onThemeChange: (theme: ThemeMode) => void;
  }
  ```

- [ ] **Step 1: Implement `ProfileMenuPopover.tsx`**

Implement floating popover with:
- Backdrop overlay with `onClose`
- User avatar circle, name, and email
- Divider
- Button for "⚙️ Kelola Akun & Kategori"
- Theme selector row (System 🌓, Light ☀️, Dark 🌙)
- Divider
- Button for "🚪 Keluar" (sign out)
- Keyboard `Escape` listener to close.

- [ ] **Step 2: Commit**

```bash
git add src/features/dashboard/ProfileMenuPopover.tsx
git commit -m "feat(dashboard): create ProfileMenuPopover component"
```

---

### Task 3: Refactor Header in `DashboardView.tsx`

**Files:**
- Modify: `src/features/dashboard/DashboardView.tsx`

- [ ] **Step 1: Replace right-hand header buttons with Avatar Trigger**

Remove `.theme-toggle-wrap`, `.btn-header-gear`, and `.btn-signout` from `.user-profile-menu`.
Replace with:
```tsx
<div className="user-profile-menu">
  <button
    type="button"
    className={`btn-header-family ${activeLedger ? 'active' : ''}`}
    onClick={() => setIsFamilySheetOpen(true)}
    title={activeLedger ? `Buku Kas: ${activeLedger.name}` : 'Buku Kas Keluarga'}
    aria-label="Buku Kas Keluarga"
  >
    <span className="btn-family-icon">👥</span>
    <span className="btn-family-label">{activeLedger ? activeLedger.name : 'Keluarga'}</span>
    {activeLedger && <span className="family-badge-dot" title="Mode Kas Bersama Aktif" />}
  </button>
  <button
    type="button"
    className="btn-header-avatar"
    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
    title="Menu Profil & Pengaturan"
    aria-label="Menu Profil & Pengaturan"
    aria-expanded={isProfileMenuOpen}
  >
    <div className="user-avatar">
      {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'U'}
    </div>
  </button>
</div>
```

- [ ] **Step 2: Render `ProfileMenuPopover` in `DashboardView.tsx`**

```tsx
<ProfileMenuPopover
  user={user}
  isOpen={isProfileMenuOpen}
  onClose={() => setIsProfileMenuOpen(false)}
  onOpenManage={() => {
    setIsProfileMenuOpen(false);
    setIsManageOpen(true);
  }}
  onSignOut={onSignOut}
  theme={theme}
  onThemeChange={setTheme}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/features/dashboard/DashboardView.tsx
git commit -m "feat(dashboard): clean up header to prevent card overflow and integrate profile menu"
```

---

### Task 4: Add Quick Preset Chips in `ManageSheet.tsx`

**Files:**
- Modify: `src/features/manage/ManageSheet.tsx`

- [ ] **Step 1: Add preset chips for common Indonesian accounts and categories**

When `isCreating && activeTab === 'accounts'`, display 1-tap chip suggestions:
`BCA`, `Mandiri`, `BRI`, `Jago`, `GoPay`, `ShopeePay`, `SPayLater`, `GoPay Later`.
Clicking auto-fills name, icon, and sets `kind`.

When `isCreating && activeTab === 'categories'`, display chip suggestions:
`Sembako 🥦`, `Pendidikan 📚`, `Donasi 🤲`, `Cicilan 💳`, `Usaha 💼`, `Bonus 🎁`.

- [ ] **Step 2: Commit**

```bash
git add src/features/manage/ManageSheet.tsx
git commit -m "feat(manage): add quick preset suggestion chips for accounts and categories"
```

---

### Task 5: CSS Styles & Gate 12 Compliance (Zero Raw Hex)

**Files:**
- Modify: `src/styles/components.css`

- [ ] **Step 1: Add styles for `.btn-header-avatar`, `.profile-popover`, `.quick-presets`**

Ensure all colors use `var(--...)` tokens with 0 raw hex.
Ensure minimum touch target is >= 44px.

- [ ] **Step 2: Verify Gate 12 (Zero Raw Hex)**

Run: `grep -iE '#[0-9a-fA-F]{3,8}' src/styles/components.css`
Expected: 0 matches

- [ ] **Step 3: Commit**

```bash
git add src/styles/components.css
git commit -m "style: add styles for profile menu popover and quick presets with 0 raw hex"
```

---

### Task 6: Verification, E2E Quality Gates & Deployment

**Files:**
- Test: All tests and gates

- [ ] **Step 1: Run all unit tests**
Run: `bun test src/`
Expected: PASS

- [ ] **Step 2: Run all 14 E2E gates**
Run: `npm run test:e2e`
Expected: 14/14 PASS

- [ ] **Step 3: Build production bundle**
Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: Deploy to Firebase**
Run: `firebase deploy`
Expected: Live deployment to `https://catat-8897d.web.app`
