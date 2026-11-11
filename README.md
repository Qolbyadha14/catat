# Catat

Aplikasi pencatatan keuangan pribadi dan keluarga (PWA, berbahasa Indonesia). Fitur utama: transaksi pemasukan/pengeluaran/transfer, akun aset dan PayLater, anggaran per kategori, statistik bulanan, buku kas keluarga dengan kode undangan, scan struk dan asisten teks/suara dengan Google Gemini (Firebase AI Logic).

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Firebase (Auth, Firestore, App Check, AI Logic, Hosting), Zod, Bun.

## Prasyarat

- [Bun](https://bun.sh) 1.3+
- Firebase CLI (`npm i -g firebase-tools`), login dengan `firebase login`
- Java 21+ untuk emulator Firestore. Script test memakai `/opt/homebrew/opt/openjdk@25/bin`; sesuaikan bila Java Anda di lokasi lain.

## Setup

```bash
bun install
cp .env.example .env   # isi konfigurasi web app Firebase
```

| Variabel | Keterangan |
|---|---|
| `VITE_FIREBASE_*` | Konfigurasi web app dari Firebase Console → Project settings |
| `VITE_USE_FIREBASE_EMULATOR` | `false` untuk memakai project cloud saat `bun run dev`; selain itu dev memakai emulator lokal |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | Site key reCAPTCHA Enterprise untuk App Check |
| `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` | Debug token App Check untuk dev dan `test:ocr-live`. **Tidak pernah ikut build produksi** (lihat `src/lib/firebase.ts`). Jangan commit nilainya. |

## Menjalankan

```bash
bun run emulators   # terminal 1: emulator Auth + Firestore (UI di http://127.0.0.1:4000)
bun run dev         # terminal 2: http://localhost:5173
```

Mode demo tanpa login dan tanpa Firestore: buka `http://localhost:5173/?demo`. Tambahkan `&theme=dark` untuk tema gelap.

## Test

| Perintah | Isi |
|---|---|
| `bun test src/` | Unit test logika murni (`src/lib`, helper fitur) |
| `bun run test:rules` | Firestore security rules di emulator (`tests/firestore.rules.test.ts`) |
| `bun run test:e2e` | Gate end-to-end di emulator Auth + Firestore (`tests/e2e-gates.test.ts`) |
| `bun run test:ocr-live` | Panggilan Gemini sungguhan; butuh debug token App Check yang terdaftar |
| `bun run lint` | oxlint |
| `bun run build` | Type check (`tsc -b`) + build produksi ke `dist/` |

## Deploy

Rules dan hosting di-deploy bersamaan, karena client mengikuti bentuk data yang divalidasi rules:

```bash
bun run build
firebase deploy --only firestore:rules,hosting
```

Setelah deploy, pastikan di situs produksi `self.FIREBASE_APPCHECK_DEBUG_TOKEN` bernilai `undefined` (DevTools Console).

## Admin

Status super admin hanya berasal dari dokumen `system_admins/{uid}` (dibuat manual lewat Firebase Console, misalnya `{ role: "superadmin" }`). Tidak ada daftar email admin di kode.

## Struktur

```
src/
  features/      UI per domain (dashboard, transactions, accounts, budgets, analytics, family, admin, ...)
  components/    layout, navigasi, modal, toast
  lib/           logika murni + layanan Firebase (schemas, ledger, OCR, NLP, filter, kalkulasi)
  styles/        design token (theme.css), Tailwind, CSS komponen
tests/           rules, e2e, dan test komponen (bun:test)
docs/            review produk dan implementation plan per fase
```
