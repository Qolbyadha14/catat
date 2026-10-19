# Multi-Screenshot & Bulk Receipt Upload Design Specification

## Overview

Aplikasi Catat memperluas kemampuan OCR digital receipt dengan dua fitur utama:
1. **Multi-Screenshot per Transaksi:** Mengatasi struk panjang (khususnya TikTok Shop dan TikTok PayLater yang membutuhkan scroll) dengan memungkinkan penggabungan 2 atau lebih tangkapan layar (misal bagian atas berisi produk & merchant + bagian bawah berisi rincian pembayaran) menjadi **satu transaksi tunggal**. Kedua gambar dikirim sebagai satu array multimodal ke Gemini 3.5 Flash Lite sehingga hanya mengonsumsi **1 kuota scan**.
2. **Bulk Upload & Batch Review Queue:** Memungkinkan pengguna mengunggah hingga 10 struk sekaligus dari berbagai platform (GoFood, Shopee, Bank Jago, TikTok, dll.). Gemini memproses struk secara paralel dan menyajikan hasilnya dalam **Batch Review Queue** di mana pengguna dapat mengoreksi data dengan cepat sebelum menyimpannya ke Firestore dalam 1 ketukan (**"Simpan Semua"**).

---

## 1. User Workflows

### 1.1 Skenario A: Struk Panjang TikTok (Multi-Screenshot 1 Transaksi)
1. Pengguna membuka modal input transaksi dan memilih tab **Scan Struk**.
2. Pengguna memilih 2 screenshot (atau paste 2 gambar berturut-turut).
3. Pengguna memilih opsi mode: `[🔘 Gabungkan jadi 1 Transaksi]`.
4. Sistem memproses kedua gambar secara multimodal dalam 1 request ke Gemini 3.5 Flash Lite.
5. Gemini menyatukan informasi: merchant dan kategori diambil dari foto produk, sedangkan nominal total akhir dan akun pembayaran diambil dari foto rincian bawah.
6. Hasil ekstraksi muncul di `OcrReviewCard` untuk konfirmasi 1-tap.

### 1.2 Skenario B: Bulk Upload Banyak Struk Sekaligus
1. Pengguna memilih 3–10 file struk sekaligus di file picker atau drag-and-drop.
2. Mode default aktif: `[🔘 Pisahkan Transaksi (Bulk)]`.
3. Tampil status progres ekstraksi (*"Memproses 3 dari 5 struk..."*).
4. Setelah selesai, tampil **Batch Review Queue**:
   - Tiap kartu struk menampilkan thumbnail mini, Merchant, Tanggal, Nominal (Rupiah), Kategori AI, dan Akun Pembayaran.
   - Pengguna dapat mengetuk nominal untuk mengubahnya langsung (misal jika ada koreksi manual), mengganti kategori/akun via pill selector, atau menekan tombol `🗑️ Hapus` untuk membatalkan struk tertentu.
5. Pengguna menekan tombol utama **"Simpan Semua (N Transaksi)"**.
6. Sistem menjalankan mutasi atomik ke Firestore, memperbarui saldo seluruh akun terkait, dan menampilkan notifikasi sukses.

---

## 2. Arsitektur & Komponen Teknis

### 2.1 Backend / OCR Engine (`geminiService.ts`)
- Fungsi `scanReceiptWithGemini` diperluas agar menerima `Blob | Blob[]`.
- Jika menerima array `Blob[]`:
  - Seluruh blob diubah menjadi inline parts base64.
  - Dikirim ke Gemini sebagai satu array contents: `[part1, part2, ..., systemPrompt]`.
  - Hanya memotong 1 kuota scan pada Firestore `scanUsage`.

### 2.2 Client Image Preprocessing (`imageProcessor.ts`)
- Penyempurnaan `calculateDimensions` untuk struk sangat tinggi (*tall aspect ratio*, misal scrolling screenshot 1080 × 4800 px):
  - Jika `height > 2 * width`, lebar gambar dipertahankan minimal 800 px (selama gambar asli mencukupi) agar teks rincian tidak gepeng dan tetap tajam saat dianalisis oleh Gemini.

### 2.3 Komponen Antarmuka (`BatchReviewQueue.tsx`)
- Komponen baru untuk mengelola state review multi-transaksi:
  ```typescript
  export interface BatchReviewItem {
    id: string; // client temporary id
    previewUrl: string;
    result: OcrReceiptResult;
    nominal: number;
    categoryId: string;
    accountId: string;
    merchant: string;
    date: string;
    isExcluded: boolean;
  }
  ```
- Fitur UI:
  - Header: Total nominal terdeteksi dari semua struk valid.
  - Kartu per item dengan indikator platform (`TikTok`, `ShopeeFood`, dll.) dan badge AI.
  - Inline input nominal dengan dukungan singkatan `k`/`rb` dan titik ribuan.
  - Footer aksi: Tombol batal dan tombol **"Simpan Semua (N Transaksi)"** dengan status loading/saving.

### 2.4 Integrasi Layanan Transaksi Atomik (`transactionService.ts`)
- Fungsi baru `createBatchTransactions(uid: string, items: CreateTransactionDto[])`:
  - Menggunakan Firestore `writeBatch` atau `runTransaction`.
  - Menghitung mutasi saldo bersih per akun untuk mencegah multiple reads/writes yang lambat.
  - Mengurangi saldo akun untuk `expense`, menambah saldo untuk `income`, dan memindahkan dana untuk `transfer`.

---

## 3. Batasan & Prinsip Keamanan Data

1. **Zero Auto-Save Guarantee:** Seluruh ekstraksi bulk tetap berupa state lokal di browser; tidak ada data yang masuk ke Firestore sebelum pengguna menekan tombol simpan.
2. **Quota Awareness:** Sistem memvalidasi sisa kuota harian (`OCR_DAILY_LIMIT = 20`) sebelum memulai batch scan. Jika batch melebihi sisa kuota, sistem memberi peringatan jelas.
3. **Maksimal 10 Struk per Batch:** Memastikan performa browser HP tetap mulus tanpa kehabisan memori.
4. **Privasi:** Seluruh gambar diproses lokal (Blob URL & inline base64). Tidak ada gambar yang diunggah ke cloud storage publik.
5. **Design System:** Menggunakan CSS tokens dari `theme.css` dengan kontras WCAG AA (>= 4.5:1 text, >= 3:1 UI) dan zero raw hex codes.

---

## 4. Rencana Pengujian (Test Strategy)

1. **Unit Tests:**
   - `geminiService.test.ts`: Pengujian multi-blob payload generator.
   - `imageProcessor.test.ts`: Pengujian aspect ratio tinggi (scrolling screenshot dimensions).
   - `BatchReviewQueue.test.ts`: Pengujian per-row edit, exclude, dan kalkulasi total batch.
   - `transactionService.test.ts`: Pengujian `createBatchTransactions` untuk integritas saldo multi-akun.
2. **Integration / E2E Tests:**
   - Pengujian flow batch upload 3 struk sekaligus pada emulator Firestore.
   - Verifikasi Gate 12 (CSS tokens & contrast) dan Gate 13 (OCR limits).
