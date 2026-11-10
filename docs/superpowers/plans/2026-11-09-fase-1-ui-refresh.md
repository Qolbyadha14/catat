# Fase 1: Refresh UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membereskan temuan UI/UX P1 dan P2 dari [`docs/review/2026-11-09-catat-product-review.md`](../../review/2026-11-09-catat-product-review.md) tanpa redesign: U1 (dark mode), U2 (`alert()`/`confirm()`), U3 (copy privasi), sebagian U4 (kontras, target sentuh, warna kategori), U5 (aksesibilitas sheet), U6 (bunyi tap), dan D2 (filter mati).

**Architecture:**
- **Dark mode:** Tailwind v4 menjalankan `dark:` berdasarkan `prefers-color-scheme`, sedangkan tombol tema di aplikasi memasang class `.dark` di `<html>`. Tambahkan `@custom-variant dark (&:where(.dark, .dark *));` agar keduanya selaras, lalu lengkapi varian `dark:` di komponen yang belum punya. Migrasi besar ke token `@theme` (C4) tetap di Fase 2.
- **Notifikasi:** satu `ToastProvider` di root (context + hook terpisah agar Fast Refresh tetap bekerja). Semua `alert()` diganti `showToast()`.
- **Sheet:** hook `useEscapeKey` untuk semua sheet dan modal; `role="dialog"` dan `aria-modal` dipasang di panel, bukan di backdrop.
- **Filter:** tombol filter di header riwayat Beranda membuka `TransactionFilterSheet`. Bagian rentang tanggal di sheet dihapus, karena data sudah dibatasi per bulan oleh navigator bulan (Fase 0).
- **Warna kategori:** fungsi murni `getCategoryTone(id, name)`. Kata kunci untuk kategori bawaan tetap dipakai, sedangkan kategori lain mendapat warna dari hash ID. Setiap warna punya varian dark.
- **Umpan balik tap:** getaran (`navigator.vibrate`) bila didukung; bunyi hanya bila diaktifkan di menu profil (default mati).

**Tech Stack:** React 19, Tailwind CSS 4, TypeScript 6, Bun test, Playwright (smoke test).

## Global Constraints

- Gate 12: `src/styles/components.css` tidak boleh berisi hex mentah. Tambahan CSS memakai `var(--...)`.
- Tidak ada perubahan schema Firestore.
- Lint tidak boleh menambah warning baru (baseline setelah Fase 0: 30).
- Teks di atas kartu gelap (hero, ringkasan aset, header anggaran) tidak diubah ke abu-abu yang lebih gelap.

## Tasks

### Task 1: Selaraskan varian `dark:` dengan tombol tema
- [ ] `src/styles/tailwind.css`: tambahkan `@custom-variant dark (&:where(.dark, .dark *));` setelah `@import "tailwindcss";`.
- [ ] `index.html`: skrip awal menganggap `theme=system` sama dengan tidak ada pilihan (ikut OS), agar tidak ada kilatan tema yang salah sebelum React berjalan. Ubah `lang="en"` menjadi `lang="id"`.
- [ ] Verifikasi: OS terang + tema "Gelap" di aplikasi → Header, BottomNav, dan kartu transaksi tampil gelap.

### Task 2: Lengkapi varian dark di komponen yang belum punya
- [ ] `HomeTab.tsx`: empty state, judul dan subtitle list, tombol aksi baris.
- [ ] `BudgetsTab.tsx`: kartu kategori, empty state, judul seksi, progress track.
- [ ] `StatsTab.tsx` dan `DonutChart.tsx`: kartu, judul, legend pill, track donut, teks tengah.
- [ ] `SearchModal.tsx` dan `BudgetModal.tsx`: panel, input, item hasil, tombol tutup.
- [ ] `BottomNav.tsx`: ring FAB (`dark:border-slate-900`) dan warna tab tidak aktif saat hover di dark mode.

### Task 3: Toast menggantikan `alert()`
- [ ] Buat `src/components/feedback/toastContext.ts` (context + tipe), `ToastProvider.tsx` (region `aria-live`, auto-dismiss 4 detik, varian `error`/`success`/`info`, di atas BottomNav), dan `useToast.ts`.
- [ ] Bungkus `<App />` dengan `ToastProvider` di `main.tsx`.
- [ ] Ganti 6 `alert()`: `DashboardView` (4), `BudgetModal` (1), `UsersLedgersTab` (1).
- [ ] Ganti `window.confirm()` di `UsersLedgersTab` dengan konfirmasi dua langkah di baris pengguna.

### Task 4: Aksesibilitas sheet dan modal
- [ ] Buat `src/lib/useEscapeKey.ts`.
- [ ] Pasang di `FamilyLedgerSheet`, `TransactionFilterSheet`, `TransactionFormSheet`, `ManageSheet`, `SearchModal`, `BudgetModal`.
- [ ] Pindahkan `role="dialog"`/`aria-modal="true"`/`aria-label` ke panel sheet.
- [ ] `BottomNav`: `aria-current="page"` untuk tab aktif.
- [ ] `base.css`: hormati `prefers-reduced-motion`.

### Task 5: Filter transaksi hidup kembali (D2)
- [ ] `HomeTab`: tombol "Filter" dengan badge jumlah filter aktif di header riwayat.
- [ ] `DashboardView`: sambungkan ke `setIsFilterSheetOpen(true)`; hapus state `searchInput` yang tidak pernah diisi (pencarian tetap lewat Search di header).
- [ ] `TransactionFilterSheet`: hapus bagian "Rentang Tanggal"; filter tipe, akun, dan kategori tetap.
- [ ] Empty state Beranda membedakan "tidak ada transaksi bulan ini" dan "tidak ada yang cocok dengan filter".

### Task 6: Warna dan ikon kategori, target sentuh, kontras
- [ ] Buat `src/lib/categoryTone.ts` + `categoryTone.test.ts`.
- [ ] `HomeTab`: pakai `getCategoryTone`, tampilkan emoji ikon kategori bila ada (sebelumnya selalu ikon dompet).
- [ ] Tombol aksi baris transaksi: ikon 14px dengan `p-2` (lebar sekitar 30px; tinggi sudah 44px dari `base.css`).
- [ ] Teks abu-abu di atas permukaan terang: `text-slate-400` → `text-slate-500 dark:text-slate-400` di BottomNav, HomeTab, BudgetsTab (di luar kartu gelap), StatsTab, SearchModal.
- [ ] Label BottomNav dan subtitle transaksi minimal 11px.

### Task 7: Umpan balik tap yang tidak mengganggu (U6)
- [ ] `src/lib/haptic.ts`: `navigator.vibrate` bila tersedia; bunyi hanya bila `localStorage['catat_tap_sound'] === 'on'`. Ekspor `isTapSoundEnabled()`/`setTapSoundEnabled()`.
- [ ] `ProfileMenuPopover`: toggle "Bunyi ketuk".

### Task 8: Copy privasi (U3)
- [ ] `mockup-preview.html`: ganti "Foto diproses di perangkatmu, tidak diunggah" dengan copy yang sesuai implementasi (foto dikirim ke Google Gemini).

### Task 9: Verifikasi
- [ ] `tsc -b`, `bun run lint`, `bun test src/`, `bun run test:e2e`, `bun run build`.
- [ ] Smoke test Playwright di `/?demo` untuk tema terang dan gelap: tidak ada error console; kartu transaksi, Anggaran, dan Statistik berlatar gelap pada tema gelap; filter bisa dibuka, diterapkan, dan di-reset; Escape menutup sheet.
- [ ] Deploy hosting.

## Di luar cakupan
- Migrasi ke token `@theme` dan pengurangan `components.css` (C4), pemecahan komponen besar (C1), pembersihan lint (C2), dead code (C3), dan validasi data di rules (C5): Fase 2.
- Pengelompokan transaksi per tanggal, skeleton loading, pencarian seluruh riwayat: Fase 2/3.
