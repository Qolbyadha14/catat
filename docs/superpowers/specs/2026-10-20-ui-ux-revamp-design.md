# Design Specification: Catat UI/UX Revamp to Premium Fintech Standard

- **Date**: 2026-10-20
- **Status**: Approved by User
- **Topic**: Full UI/UX Revamp of Catat Web Application based on `sample-ui-ux` (FinTrax reference)
- **Author**: Antigravity & User

---

## 1. Objective & Background

The current Catat application provides comprehensive financial tracking capabilities (income, expense, inter-account transfers, receipt OCR scanning, NLP text-based quick entry, family ledgers, PayLater liability management, debt snowball/avalanche strategies, and Firestore real-time sync). However, its user interface is organized as a single, vertically stacked scrolling page with basic styling.

The user has provided a reference application (`sample-ui-ux`) modeled after modern high-end fintech apps. This specification outlines the end-to-end revamp of Catat's UI/UX to match this aesthetic, adopting a 4-tab bottom navigation architecture while preserving 100% of Catat's core features, logic, and test coverage.

---

## 2. Technical Stack & Foundation

1. **Framework & Runtime**:
   - React 19 + TypeScript + Vite.
   - Bun runtime for tests and script execution.
2. **Styling System**:
   - **Tailwind CSS v4** (`@tailwindcss/vite` and `@import "tailwindcss";`) configured with custom design tokens:
     - Primary brand colors: Electric Blue (`#1244d3`, `#0070f3`), Teal/Emerald (`#10b981`), Amber (`#f59e0b`), Rose (`#f43f5e`), Slate (`#0b0f19`, `#0f172a`, `#f8fafc`).
     - Radii: `rounded-[28px]`, `rounded-[32px]`, `rounded-[36px]`, `rounded-full`.
     - Typography: `Plus Jakarta Sans` for clean, modern readability; `JetBrains Mono` for currency and card numbers.
     - Glassmorphism & subtle blur filters (`backdrop-blur-md`, `backdrop-blur-xl`).
3. **Iconography**:
   - `lucide-react` for modern, scalable, and lightweight icons across all tabs and buttons.
4. **Haptic Audio Feedback**:
   - Lightweight synthesized Web Audio click/tap/success/delete sound feedback (`playHapticSound`) to provide native mobile tactile response.

---

## 3. Application Frame & Navigation Architecture

### 3.1 Mobile Container Shell (`MobileFrame`)
- Centered mobile viewport (`max-w-[420px]`) on desktop viewports.
- Desktop preview mode toggle allowing switching between **Mockup HP** (with simulated speaker notch, time, 5G indicator, and battery) and **Layar Penuh (Full Screen)**.
- Integrated audio mute/unmute control for haptic sound effects.

### 3.2 Top Header (`Header`)
- **Left**: User Profile avatar with online status indicator, user greeting ("Selamat Datang, [Name]").
- **Right Action Bar**:
  - **Buku Kas Switcher Pill**: Displays current ledger status ("Pribadi" vs "Keluarga") with indicator dot; tap opens the `FamilyLedgerSheet` to manage family members, share invite codes, or switch ledgers.
  - **Quick Search Button**: Opens `SearchModal` with live filtering.
  - **Profile / Settings Button**: Triggers `ProfileMenuPopover` for dark/light mode toggle, managing accounts/categories, and signing out.

### 3.3 Bottom Navigation Bar (`BottomNav`)
Floating bottom pill dock (`rounded-[30px]`, `bg-white/95 backdrop-blur-xl`) containing:
1. **Beranda (Home)**: Icon `Home`, label "Beranda".
2. **Dompet (Accounts)**: Icon `Wallet`, label "Dompet".
3. **Floating Center Button (+)**: Floating emerald/teal pill with shadow, triggers the `TransactionFormSheet` modal.
4. **Anggaran (Budgets)**: Icon `Target`, label "Anggaran".
5. **Statistik (Analytics)**: Icon `BarChart3`, label "Statistik".

---

## 4. Tab Views & Functional Components

### 4.1 Tab 1: Beranda (Home Dashboard)
- **Electric Blue Hero Balance Card**:
  - Deep gradient background (`from-[#1244d3] via-[#1a56ea] to-[#0c319e]`) with subtle ambient glowing circles.
  - Net Balance headline (`Saldo Bersih = Total Aset - Total Liabilitas PayLater`).
  - Month dropdown selector for switching historical periods.
  - **Interactive Cashflow SVG Wave Chart**: Smooth cubic bezier curve mapping daily account balances with interactive tooltip pin display upon touch or hover.
  - Sub-bar stats:
    - `Pemasukan (+)`: Total monthly income in green pill.
    - `Pengeluaran (-)`: Total monthly expense in rose/red pill.
    - `Arus Kas Bersih`: Net flow (Surplus/Defisit) in cyan/blue pill.
- **Upcoming PayLater & Bill Reminders**:
  - Horizontal carousel/cards showing active liability due dates.
  - One-tap `⚡ Bayar` button that immediately opens transfer sheet pre-filled.
- **Daily Transaction Tracking (`TransactionList`)**:
  - Grouped chronologically: "Hari Ini", "Kemarin", or formatted date.
  - Category squircle icons with soft pastel backgrounds.
  - Transaction Title, Account, Notes, and Family Member creator indicator.
  - Receipt items badge (e.g. `🛒 3 item`) if transaction includes scanned breakdown.
  - Swipe or hover action buttons: Duplicate (📋), Edit, Delete.

### 4.2 Tab 2: Dompet (Accounts & PayLater Hub)
- Total Net Worth & Account Count overview header.
- **Physical ATM / E-Wallet Card Carousel**:
  - Realistic card styling featuring EMV chip visual, metallic gloss reflection, masked number (`•••• 5083`), bank logo (BCA, Mandiri, GoPay, etc.), balance, and account holder name.
- **Uang Saya (Asset Accounts)**:
  - Bank, E-Wallet, and Cash accounts listing current balances with total assets calculation.
- **PayLater & Tagihan (Liabilities)**:
  - Dedicated liability section for CIMB CC, Shopee PayLater, GoPay Later, and KTA loans.
  - Status badges (`Tagihan: Rp X` vs `✓ Semua Lunas`).
  - **Integrated Debt Snowball & Avalanche Planner**:
    - Recommended monthly payment target according to chosen debt elimination strategy.
    - Immediate `⚡ Bayar` action linking source asset to liability account.
- **Add Account Action**:
  - Button to add new bank/wallet/liability account with color gradient picker.

### 4.3 Tab 3: Anggaran (Budgets)
- Monthly category budget tracking cards.
- Visual meter/progress bar comparing actual spent against monthly budget limit.
- Remaining budget indicators ("Tersisa Rp X dari Rp Y").
- Financial health badges:
  - `✓ Aman (On Track)` if spending is below 80%.
  - `⚠️ Perlu Berhemat` if spending exceeds 80% or goes over limit.
- Budget editing modal allowing setting/adjusting category budgets, persisted directly to Firestore.

### 4.4 Tab 4: Statistik (Analytics & Reports)
- **Interactive Donut Chart**:
  - Visual slice breakdown of expenses by category with percentages and amounts.
  - Center cutout displaying total monthly expense.
  - Category legend pills below the chart.
- **Weekly Cashflow Bar Chart**:
  - Monday to Sunday spending analysis bars identifying peak spending days.
- **Export Financial Report**:
  - One-click export to CSV format compatible with Excel and Google Sheets.

---

## 5. Transaction Form Sheet (`TransactionFormSheet`)

Sliding bottom sheet modal (`rounded-t-[36px]`) supporting:
1. **Transaction Type Segment**: `Pengeluaran` (Expense), `Pemasukan` (Income), `Transfer` (Antar-Akun).
2. **Quick Amount Chips**: Instant +20rb, +50rb, +100rb, +250rb, +500rb taps.
3. **Preserved Multi-Modal Input Modes**:
   - **Manual**: Category selection, account selection, date/time, note, and itemized receipt entries.
   - **Ketik (NLP Quick Input)**: Natural language string parsing (e.g., "beli kopi 25rb pakai gopay").
   - **Scan Struk (OCR AI)**: Camera photo / file upload of Indomaret/Alfamart/grocery receipts, client-side parsing, item extraction, and confidence review.
4. **Validation & Atomic Updates**: Full Zod schema validation, atomic Firestore batching for transfers.

---

## 6. Verification & Quality Assurance Strategy

1. **Test Suite Preservation**:
   - `bun test src/`: Account calculations, debt snowball, cashflow math, transaction duplicate helper, filters.
   - `bun test tests/firestore.rules.test.ts`: Security rules.
   - `bun test tests/ocr-live.test.ts`: Receipt OCR integration.
   - `bun test tests/e2e-gates.test.ts`: End-to-end transaction flow.
2. **Lint & Build**:
   - `oxlint`: Ensure zero syntax or type warnings.
   - `bun run build`: Validate production bundle compilation without errors.
