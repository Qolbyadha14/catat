# Fase 2: Kualitas Kode, Validasi Data & Perbaikan Bug

Lanjutan dari [review](../../review/2026-11-09-catat-product-review.md), Fase 0 dan Fase 1. Dokumen ini mencatat apa yang dikerjakan dan hasil verifikasinya.

## Dikerjakan

### Validasi data di rules (C5)
- `firestore.rules`: transaksi wajib berbentuk valid (id = ID dokumen, tipe `income|expense|transfer`, nominal bilangan bulat 1..1 triliun, tanggal int, akun/kategori atau dua akun transfer yang berbeda, catatan ≤ 140 karakter).
- `createdBy` saat membuat harus penulisnya sendiri; saat mengedit, atribusi lama boleh dipertahankan (anggota keluarga bisa mengedit transaksi anggota lain tanpa memalsukan pembuatnya). `createdAt` tidak boleh diubah.
- Akun: nama 1..40, `kind` valid, saldo bilangan bulat. Kategori: nama 1..32, tipe valid, `monthlyBudget` int ≥ 0 atau null (dokumen lama).
- 5 test rules baru (29 total).

### Bug yang ditemukan dan diperbaiki
| Bug | Dampak | Perbaikan |
|---|---|---|
| `createAccount`/`createCategory` menulis `icon: undefined` | Menambah akun/kategori tanpa ikon gagal dengan error Firestore | Field opsional hanya ditulis bila terisi (Gate 17) |
| Menghapus anggaran kategori menyimpan `monthlyBudget: null` | `categorySchema` gagal parse, kategori hilang dari aplikasi | Simpan dengan `deleteField()`; `parseCategoryDoc` memulihkan dokumen lama berisi null (Gate 17) |
| Buat buku kas / gabung memakai objek `{ uid, name }` | Nama buku kas jadi "Keluarga Keluarga", nama anggota baru jadi "Anggota" | `useFamilyLedger` mengirim `displayName`/`email` asli |
| Ekspor CSV Statistik memakai `exportCsv.ts` | Tanggal berupa angka epoch, nama berkoma merusak kolom, tanpa proteksi formula injection | Memakai `lib/exportTransactionsCSV` (Gate 8); `exportCsv.ts` dihapus |
| Recognizer suara memakai `handleProcess` dari render pertama | Hasil suara diproses dengan kategori/akun lama | `useEffectEvent` |
| Listener paste struk dengan dependency tidak lengkap | Paste memakai state lama (mode scan, kuota) | `useEffectEvent`, listener dipasang sekali |
| Tanda "–" di kartu saldo terpisah baris dari nominal; nominal jutaan meluap | Ringkasan bulanan sulit dibaca di layar sempit | Satu node teks + tata letak 2 kolom dan baris arus kas |
| Tooltip grafik saldo terpotong di tepi kartu | Nominal titik terakhir tidak terbaca | Posisi dibatasi 20%–80% |

### Admin (S5)
- `KNOWN_ADMIN_EMAILS` dihapus. Status admin hanya dari `system_admins/{uid}`, sama dengan `isSuperAdmin()` di rules.

### Struktur kode (C1, C2, C3)
- `DashboardView`: logika buku kas pindah ke `features/family/useFamilyLedger.ts`; dialog hapus ke `features/transactions/DeleteTransactionDialog.tsx`; empat state form transaksi digabung menjadi satu union `TransactionSheetState`.
- `useAccounts`, `useCategories`, `useAuth`, `useSuperAdmin`, `BudgetModal`, `JoinLedgerDialog`: tidak lagi memanggil setState sinkron di effect (state di-key per sumber data, atau komponen di-mount ulang dengan `key`).
- Helper non-komponen dipindah dari file komponen agar Fast Refresh bekerja: `accountPills.ts`, `categoryChips.ts`, `ocrReview.ts`, `batchReview.ts`, `receiptFiles.ts`.
- Dead code dihapus: `CategoryBreakdown`, `MonthNavigator` (komponen), `TransactionHistoryHeader`, `TransactionSearchBar`, `AccountCardCarousel`, `analytics/exportCsv.ts`.
- `README.md` ditulis ulang (setup, env, emulator, test, deploy, admin).

## Verifikasi

| Pemeriksaan | Sebelum Fase 2 | Sesudah |
|---|---|---|
| `tsc -b` | 0 error | 0 error |
| `bun run lint` | 29 warning | 2 warning |
| `bun test src/` | 0 error | 0 error |
| `bun run test:rules` | 24 pass | 29 pass |
| `bun run test:e2e` | 17 pass | 18 pass |
| Smoke test browser (`/?demo`, tema gelap) | — | 9/9: hero tidak meluap di 360/400px, judul transaksi utuh, dialog hapus (Escape/Batal), form (Escape), nilai awal modal anggaran per kategori, ekspor CSV (BOM + tanggal), link `?code=` mengisi dialog gabung, tanpa error console |

Sisa 2 warning lint adalah setState di effect yang memang menyinkronkan sistem eksternal (object URL thumbnail struk, muat data admin).

## Belum dikerjakan
- Migrasi token warna ke `@theme` Tailwind dan pengurangan `components.css` (C4).
- Migrasi test `src/` ke `bun:test` (butuh tipe Bun di `tsconfig.app.json`).
- Pemecahan `TransactionFormSheet` (≈1000 baris) dan `ReceiptScanTab` (≈900 baris).
- Manifest ganda (`public/manifest.json` vs `site.webmanifest`).
