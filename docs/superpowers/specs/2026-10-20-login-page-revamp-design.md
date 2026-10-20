# Design Specification: Login Page Revamp (Modern Fintech Splash Card)

## 1. Background & Goals
The current Login Page (`src/features/auth/LoginView.tsx`) is bare and functional, but lacks visual polish, credibility, and brand presence. For new and returning users visiting `https://catat.coreboylabs.com`, the landing experience should evoke confidence, clarify the value of Catat, and provide a frictionless sign-in flow.

### Goals
- **Professional Brand Anchor**: Showcase the new official vector branding (`catat-logo.svg` / `catat-logo-dark.svg`) and slogan.
- **Value Proposition Highlights**: Inform users of core capabilities (AI OCR receipt scanner, family collaborative ledgers, PayLater/debt cashflow tracking) before signing in.
- **Fintech Trust & Security Signals**: Display encryption/security assurance and CoreboyLabs attribution.
- **Thumb-Friendly & Responsive**: Centered glassmorphic card on desktop/tablet, perfectly fitted viewport on mobile without unnecessary scroll.
- **Zero Regressions**: Preserve existing Firebase Auth popup logic (`onSignIn`), loading states, and error banner handling.

---

## 2. Visual & Layout Architecture

### 2.1 Atmosphere & Backdrop
- **Container**: `min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden`.
- **Ambient Glow**: Soft radial gradient blobs in emerald (`bg-emerald-500/10 blur-3xl rounded-full`) placed in background for subtle modern fintech depth.

### 2.2 Main Card (`LoginView.tsx`)
- Card wrapper: `max-w-md w-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col items-center text-center`.
- **Top Badge**: `✨ v2.0 • Pintar & Kolaboratif` in a soft emerald pill (`bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 text-[11px] font-bold px-3 py-1 rounded-full mb-3`).
- **Brand Logo**:
  ```tsx
  <picture className="mb-2 block">
    <source media="(prefers-color-scheme: dark)" srcSet="/brand/catat-logo-dark.svg" />
    <img
      src="/brand/catat-logo.svg"
      alt="catat by coreboylabs"
      className="w-52 max-w-xs h-auto mx-auto"
    />
  </picture>
  ```
- **Tagline**: *"Catat keuangan, hidup lebih tenang."* in `text-xs text-slate-500 dark:text-slate-400 font-medium`.

---

## 3. Feature Highlights (3 Value Proposition Pills)
Between the tagline and the sign-in button, render 3 compact horizontal feature pills to highlight Catat's standout features:

1. **Scan Struk AI**:
   - Icon: `Receipt` or `Sparkles` in emerald squircle (`bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400`).
   - Title: **Scan Struk AI**
   - Subtitle: Catat transaksi instan dari foto/kamera struk.
2. **Buku Kas Bersama**:
   - Icon: `Users` in blue squircle (`bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400`).
   - Title: **Buku Kas Keluarga**
   - Subtitle: Sinkronisasi real-time bersama pasangan & keluarga.
3. **Arus Kas & PayLater**:
   - Icon: `TrendingUp` or `CreditCard` in amber/purple squircle.
   - Title: **Arus Kas & PayLater**
   - Subtitle: Pantau jatuh tempo tagihan & anggaran bulanan.

---

## 4. Call-to-Action & Error Handling

### 4.1 Google Sign-In Button
- Full width within card (`w-full py-3.5 px-4 rounded-2xl`).
- High-contrast styling with white/dark background, subtle border, and Google "G" SVG icon.
- Interactive feedback: `hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-98 transition-all`.
- Loading State: Spinner with *"Menghubungkan ke Google..."*.
- Disabled state while `isBusy`.

### 4.2 Error Banner
- Rendered gracefully between feature pills and CTA if `error` is present.
- Alert pill with retry encouragement and clear typography.

### 4.3 Security & Trust Signals
- Security badge: `🔒 Data terenkripsi & tersimpan aman di cloud Firebase` in `text-[11px] text-slate-400 mt-4`.
- Footer note: `Crafted with care by CoreboyLabs` in `text-[10px] text-slate-400/80 mt-1`.

---

## 5. Testing & Verification
- Unit test for `LoginView` rendering, button trigger, and loading state.
- `bun run lint` and `bun run build` must pass with 0 errors and 0 warnings.
- Test both light and dark mode appearances.
