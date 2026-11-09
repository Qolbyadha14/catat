# Review Produk Catat: Kode, Keamanan, dan UI/UX

Tanggal: 9 November 2026
Basis: branch `main` @ `0b056ef`
Cakupan: seluruh `src/`, `firestore.rules`, `index.html`, `public/`, `package.json`, `mockup-preview.html`

---

## 1. Ringkasan

Catat adalah PWA pencatatan keuangan pribadi dan keluarga berbahasa Indonesia (React 19, Vite 8, Tailwind 4, Firebase Auth/Firestore/AI Logic). Fiturnya sudah lengkap: transaksi income/expense/transfer, akun aset dan liabilitas, PayLater dan tagihan, anggaran per kategori, statistik, debt planner, buku kas keluarga, scan struk dengan Gemini, asisten teks, input suara, dan dashboard admin.

**Rekomendasi arah: jangan tambah fitur dulu.** Urutannya:

1. **Fase 0, perbaikan wajib (keamanan dan kebenaran data).** Ada celah di Firestore rules yang membuat pengguna mana pun yang login bisa masuk ke buku kas keluarga orang lain tanpa kode undangan. Selain itu, semua angka bulanan, anggaran, statistik, dan export CSV dihitung dari 50 transaksi terakhir saja, jadi hasilnya salah begitu pengguna punya lebih dari 50 transaksi.
2. **Fase 1, refresh UI secara bertahap (bukan redesign total).** Fondasinya sudah benar (design token, pola mobile, bottom nav + FAB). Masalah utamanya inkonsistensi: dark mode bolong, tiga sistem styling yang berjalan bersamaan, `alert()` native, teks terlalu kecil, dan target sentuh terlalu kecil.
3. **Fase 2, rapikan struktur kode.** Pecah komponen besar, bereskan 32 warning lint, hapus dead code, dan perbaiki test runner.
4. **Fase 3, baru fitur baru.**

---

## 2. Metode dan bukti

Yang saya jalankan dan baca:

| Pemeriksaan | Hasil |
|---|---|
| `tsc -b` | Lulus, 0 error |
| `bun run lint` (oxlint) | 0 error, 32 warning (13 `set-state-in-effect`, 11 `only-export-components`, 3 `exhaustive-deps`, 3 `purity`, 2 `immutability`) |
| `bun test src/` | **Gagal**: 1 fail di `transactionFilter.test.ts:136` |
| Ukuran kode | 127 file TS/TSX, sekitar 17.500 baris, 42 file test di `src/` + file di `tests/` |
| Firestore rules | Dibaca manual dan dicocokkan dengan `ledgerService.ts` dan `geminiService.ts` |
| Metrik UI | Hitungan grep untuk kelas `dark:`, ukuran font, warna hardcoded, inline style, kelas CSS tidak terpakai |

Yang **belum** saya jalankan: `test:rules`, `test:e2e`, dan `test:ocr-live` (butuh emulator dan Java), serta pengecekan visual aplikasi di browser untuk light dan dark mode. Konfigurasi di Firebase Console (enforcement App Check, rate limit AI Logic, debug token yang terdaftar) juga tidak bisa saya lihat dari repo.

---

## 3. Daftar temuan berdasarkan prioritas

| ID | Prioritas | Area | Temuan |
|---|---|---|---|
| S1 | P0 | Keamanan | Pengguna mana pun yang login bisa menambahkan dirinya ke ledger mana pun, atau mengubah/menghapus anggota lain, tanpa kode undangan |
| S2 | P0 | Keamanan | Dokumen ledger (termasuk email semua anggota dan invite code) bisa dibaca oleh semua pengguna yang login |
| S3 | P0 | Keamanan | App Check debug token ter-commit di repo dan ikut ter-bundle di build produksi |
| D1 | P0 | Data | Semua ringkasan, anggaran, statistik, dan export CSV hanya memakai 50 transaksi terakhir |
| S4 | P1 | Keamanan/Biaya | Kuota scan OCR bisa di-reset oleh pengguna sendiri, dan hanya dicek di client |
| S5 | P1 | Keamanan | Status admin di UI ditentukan dari daftar email yang di-hardcode di client |
| D2 | P1 | Data/UX | Filter transaksi tidak bisa dibuka dari mana pun (fitur mati) |
| D3 | P1 | Data/UX | Daftar transaksi di Beranda dan tab Anggaran tidak mengikuti bulan yang dipilih |
| T1 | P1 | Test | 1 test gagal karena bergantung pada tanggal hari ini; format test tidak terbaca granular oleh `bun test` |
| U1 | P1 | UI | Dark mode tidak konsisten di sebagian besar komponen |
| U2 | P1 | UX | Error dan konfirmasi memakai `alert()`/`confirm()` native |
| U3 | P1 | UX/Privasi | Copy di mockup ("Foto diproses di perangkatmu, tidak diunggah") bertentangan dengan implementasi |
| U4 | P2 | Aksesibilitas | Kontras teks abu-abu rendah, banyak teks 8 sampai 11px, target sentuh 20px |
| U5 | P2 | Aksesibilitas | Bottom sheet tanpa focus trap dan tanpa tombol Escape; `lang="en"` untuk aplikasi berbahasa Indonesia |
| U6 | P2 | UX | "Haptic" sebenarnya bunyi beep di setiap tap, tanpa opsi mematikan |
| C1 | P2 | Kode | Tiga komponen di atas 640 baris, terutama `DashboardView` |
| C2 | P2 | Kode | 32 warning lint, beberapa berpotensi bug |
| C3 | P2 | Kode | Dead code: 4 komponen dan 77 kelas CSS tidak terpakai |
| C4 | P2 | Kode | Tiga sistem styling berjalan bersamaan |
| C5 | P2 | Keamanan | Rules tidak memvalidasi bentuk data transaksi dan saldo akun |

---

## 4. Keamanan

### S1. Join ledger tanpa kode undangan (P0)

`firestore.rules`:

```
allow update: if isLedgerMember(ledgerId) || (
  isAuthenticated() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members', 'updatedAt'])
);
```

Untuk non-anggota, rule ini hanya mengecek bahwa field yang berubah adalah `members` dan `updatedAt`. Isi `members` tidak divalidasi sama sekali. Akibatnya:

- Siapa pun yang login bisa menulis map `members` baru, menambahkan dirinya dengan `role: 'owner'`, atau menghapus anggota lain.
- Invite code hanya dicek di client (`joinLedgerByCode`), jadi bisa dilewati dengan memanggil SDK langsung.
- ID ledger sama dengan UID pemilik (`createAndSaveLedger` memakai `doc(db, 'ledgers', owner.uid)`), sehingga mudah ditebak.
- Setelah masuk `members`, `isLedgerMember` lolos dan penyerang bisa membaca dan menulis semua transaksi keluarga itu.

Anggota yang sah juga bisa mengubah field apa pun, termasuk `ownerUid` dan `inviteCode`, karena cabang `isLedgerMember(ledgerId)` tidak membatasi field.

**Perbaikan yang disarankan:**

1. Pindahkan pencarian kode ke koleksi terpisah `invites/{code}` yang berisi `{ ledgerId }`, dengan `allow get: if isAuthenticated()` dan `allow list: if false`. Dengan begitu kode tidak bisa di-enumerate.
2. Rule join untuk non-anggota hanya boleh menambah entry miliknya sendiri, dengan role `member`, dan harus membuktikan kode:

```
allow update: if isLedgerMember(ledgerId)
    && request.resource.data.ownerUid == resource.data.ownerUid
    && request.resource.data.inviteCode == resource.data.inviteCode
  || (
    isAuthenticated()
    && !(request.auth.uid in resource.data.members)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members', 'updatedAt'])
    && request.resource.data.members.diff(resource.data.members).affectedKeys().hasOnly([request.auth.uid])
    && request.resource.data.members[request.auth.uid].role == 'member'
    && request.resource.data.members[request.auth.uid].joinCode == resource.data.inviteCode
  );
```

3. Hanya owner yang boleh menghapus anggota lain atau mengganti invite code.
4. Tambahkan test kasus penyerang ke `tests/firestore.rules.test.ts`: join tanpa kode, join sebagai owner, menghapus anggota lain.

Catatan: rule di atas adalah titik awal dan perlu diuji di emulator sebelum deploy.

### S2. Dokumen ledger terbuka untuk semua pengguna (P0)

```
allow read: if isSuperAdmin() || isLedgerMember(ledgerId) || (
  isAuthenticated() && resource != null && resource.data.inviteCode != null
);
```

Schema mewajibkan `inviteCode` (min 6 karakter), jadi kondisi ketiga benar untuk semua ledger. Artinya semua pengguna yang login bisa membaca dokumen ledger mana pun, termasuk nama dan email semua anggota. Query list dengan filter `inviteCode` kemungkinan besar juga lolos, sehingga ledger bisa di-enumerate.

**Perbaikan:** batasi `read` ke anggota dan super admin. Alur join memakai `invites/{code}` dari S1.

### S3. App Check debug token di repo dan di bundle produksi (P0)

Script `test:ocr-live` di `package.json` dan `tests/ocr-live.test.ts` berisi token `51561ED6-...`. Kedua file ini ter-commit.

Masalah yang lebih besar ditemukan saat menyusun plan Fase 0. `src/lib/firebase.ts` memasang `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` tanpa mengecek mode, dan `.env` berisi variabel itu. Akibatnya bundle produksi `dist/assets/index-TcwpGAE0.js` berisi `self.FIREBASE_APPCHECK_DEBUG_TOKEN="<token yang sama>"`. Bundle ini tercatat di `.firebase/hosting.ZGlzdA.cache`, artinya kemungkinan besar sudah ter-deploy. Jadi setiap pengunjung produksi memakai debug provider, dan siapa pun bisa mengambil token dari bundle untuk melewati App Check.

**Perbaikan:** pasang debug token hanya di Vite dev dan test, deploy build baru, **lalu** cabut token lama di Firebase Console. Urutan ini penting: jika token dicabut sebelum build baru live, semua pengunjung yang masih memakai bundle lama gagal App Check. Detailnya ada di Task 1 dan Task 11 plan Fase 0.

### S4. Kuota OCR bisa dilewati (P1)

- Rule `scanUsage` hanya mengecek `count <= 20` saat update. Pengguna bisa menulis `count: 0` kapan saja dan kuotanya kembali penuh.
- Gemini dipanggil langsung dari client lewat `firebase/ai`. Pengecekan `checkScanQuota` dan `incrementScanUsage` berjalan di client, jadi pengguna yang memanggil SDK langsung tidak terkena kuota sama sekali.
- `rateLimiter.ts` menyimpan hitungan di `localStorage`, yang bisa dihapus pengguna.

**Perbaikan:**

- Rule: `request.resource.data.count == resource.data.count + 1` untuk update, dan `count == 1` untuk create.
- Aktifkan rate limit per pengguna di pengaturan Firebase AI Logic dan pastikan App Check di-enforce untuk AI Logic.
- Jika biaya Gemini mulai berarti, pindahkan panggilan ke Cloud Function yang mengecek kuota di server.

### S5. Admin ditentukan dari email di client (P1)

`useSuperAdmin.ts` punya `KNOWN_ADMIN_EMAILS` (termasuk email pribadi) sebagai jalur cepat. Ini hanya membuka UI admin; data admin tetap dilindungi `isSuperAdmin()` di rules yang mengecek `system_admins/{uid}`. Masalahnya ada dua sumber kebenaran yang bisa berbeda, dan email pribadi ikut ter-commit.

Selain itu `system_admins` bisa dibaca oleh semua pengguna yang login (`allow read: if isAuthenticated()`), sehingga daftar UID admin bisa diketahui.

**Perbaikan:** hapus daftar email, pakai `system_admins/{uid}` atau custom claims sebagai satu-satunya sumber. Batasi read `system_admins` ke dokumen milik sendiri: `allow get: if request.auth.uid == adminUid`.

### C5. Rules tidak memvalidasi data (P2)

Koleksi `transactions` memakai `allow read, write` tanpa validasi bentuk. Saldo akun dihitung di client (`runTransaction` di `transactionService.ts`), jadi anggota ledger bisa menulis saldo atau nominal apa pun. Untuk aplikasi pribadi risikonya kecil. Untuk ledger keluarga, minimal validasi `amount is int && amount > 0`, `type in [...]`, dan `createdBy.uid == request.auth.uid`.

---

## 5. Kebenaran data

### D1. Hanya 50 transaksi yang dipakai untuk semua perhitungan (P0)

`DashboardView.tsx:77`:

```ts
const { transactions } = useTransactions(user.uid, 50, activeLedgerId || undefined);
```

Array 50 transaksi ini menjadi satu-satunya sumber untuk:

- Pemasukan, pengeluaran, dan cashflow bulanan di `BalanceHeroCard`
- Progres anggaran di `BudgetsTab`
- Donut chart dan weekly cashflow di `StatsTab`
- Export CSV (`StatsTab.handleExportCsv`), yang hanya mengekspor 50 baris
- Search modal dan deteksi duplikat di form

Satu keluarga yang mencatat 3 sampai 4 transaksi per hari akan melewati 50 transaksi dalam dua minggu. Setelah itu angka bulan berjalan jadi lebih kecil dari seharusnya, bulan sebelumnya tampil kosong saat dinavigasi, dan export tidak lengkap. Pengguna tidak mendapat tanda apa pun bahwa datanya terpotong.

**Perbaikan:**

- Query per bulan: `where('date', '>=', startOfMonth), where('date', '<', endOfMonth)` untuk ringkasan, anggaran, dan statistik.
- Riwayat dengan pagination (`startAfter`) untuk daftar transaksi.
- Export CSV mengambil data sesuai rentang yang dipilih, bukan dari state.
- Untuk jangka panjang, pertimbangkan dokumen agregat bulanan (`monthlySummary/{yyyy-mm}`) yang diperbarui di `runTransaction` yang sama.

### D2. Filter transaksi tidak bisa dibuka (P1)

`TransactionFilterSheet` hanya dirender saat `isFilterSheetOpen` bernilai true, tapi `setIsFilterSheetOpen(true)` tidak dipanggil di mana pun. `searchInput` juga hanya pernah di-set ke string kosong. Komponen `TransactionHistoryHeader` (yang berisi search bar) tidak dirender. Akibatnya tombol "Reset Filter" di Beranda tidak pernah muncul, dan logika filter yang sudah dites tidak bisa dipakai pengguna.

### D3. Bulan yang dipilih tidak konsisten (P1)

- Beranda: hero card mengikuti bulan yang dipilih, tapi daftar "Pelacakan Transaksi Harian" di bawahnya menampilkan 50 transaksi terakhir dari semua bulan.
- `BudgetsTab` selalu memakai `new Date()` (bulan berjalan) dan mengabaikan `selectedMonth`.
- `StatsTab` memakai `selectedMonth`.

Pengguna yang pindah ke Oktober melihat ringkasan Oktober, daftar November, dan anggaran November dalam satu sesi.

---

## 6. Kualitas kode

### Yang sudah baik

- Zod sebagai sumber tipe (`schemas.ts`), dengan discriminated union untuk tipe transaksi.
- Logika bisnis terpisah di `lib/` (cashflow, budgeting, debtPlanner, bills, filter) dan bisa dites tanpa React.
- Perubahan saldo memakai `runTransaction`, termasuk transfer dua sisi dan batch dari scan struk.
- Firestore offline persistence aktif (`persistentLocalCache`).
- AI punya kill switch, model fallback, timeout, `AbortController`, dan telemetri.
- `tsc` bersih, penggunaan `any` minim dan terbatas di modul speech dan mock.

### T1. Test (P1)

- `transactionFilter.test.ts:136` gagal. Penyebabnya: data test berada di Oktober 2026 dan memakai preset `this_month`, sedangkan `getPresetRange` membaca `new Date()`. Test lulus di bulan Oktober dan gagal sejak November. Perbaikan: `filterTransactions` menerima parameter `now` opsional, dan test memakai nilai tetap.
- Semua 42 file test di `src/` memakai `assert()` di top level, bukan `test()`/`describe()`. `bun test` melaporkan "Ran 1 test across 42 files". Satu assert gagal menghentikan seluruh file, dan CI tidak bisa menunjukkan skenario mana yang gagal. Migrasi ke `test()` dari `bun:test` bisa dilakukan bertahap per file.

### C1. Komponen terlalu besar (P2)

| File | Baris |
|---|---|
| `TransactionFormSheet.tsx` | 998 |
| `ReceiptScanTab.tsx` | 936 |
| `ManageSheet.tsx` | 747 |
| `DashboardView.tsx` | 643 |

`DashboardView` memegang sekitar 25 `useState` dan semua handler untuk ledger keluarga, filter, sheet, dialog hapus, dan pembayaran tagihan. Pemecahan yang disarankan:

- `useFamilyLedger(uid)` untuk state dan handler ledger
- `useTransactionSheet()` untuk mode edit, duplikat, dan prefill transfer (sekarang empat state yang di-set atau di-reset bersamaan di tujuh tempat)
- `DeleteTransactionDialog` sebagai komponen sendiri
- `useMonthSelection()` dibagikan lewat context agar D3 selesai sekaligus

### C2. Warning lint yang perlu dibereskan (P2)

Yang berpotensi bug, diurutkan dari yang paling penting:

- `react(immutability)` di `ReceiptScanTab.tsx:178`: `handleFilesSelected` dibaca sebelum diinisialisasi.
- `react-hooks(exhaustive-deps)` di `TextAssistantTab.tsx:103`, `ReceiptScanTab.tsx:178`, `UsersLedgersTab.tsx:132`: risiko stale closure.
- `react(purity)` di `TransactionFormSheet.tsx:195`, `BudgetsTab.tsx:21`, `UsersLedgersTab.tsx:43`: `Date.now()`/`new Date()` saat render.
- `react(immutability)` di `DonutChart.tsx:36`: variabel akumulasi di-reassign saat render. Hitung dengan `reduce` di `useMemo`.
- 13 `set-state-in-effect`: sebagian besar pola reset state di awal effect subscription (`useAccounts`, `useCategories`, `useTransactions`). Pola ini bisa diganti dengan menginisialisasi state dari key atau memindahkan cabang showcase ke luar effect.
- 11 `only-export-components`: pindahkan helper yang di-export dari file komponen ke file `.ts` terpisah agar Fast Refresh bekerja.

### C3. Dead code (P2)

- Komponen tidak dirender di mana pun: `CategoryBreakdown`, `MonthNavigator`, `TransactionHistoryHeader`, `AccountCardCarousel`.
- Props tidak terpakai di `HomeTab`: `categories`, `onOpenBudgetsTab`, `transactions`.
- 77 dari 482 kelas di `components.css` tidak dirujuk di file TS/TSX mana pun.
- Kelas `animate-in fade-in` tidak didefinisikan (tidak ada `tailwindcss-animate`), jadi tidak berefek.
- Dua manifest berbeda isi: `public/manifest.json` dan `public/site.webmanifest`. `index.html` hanya memakai yang kedua.
- `mockup-preview.html` dan `preview-screenshot.png` ter-commit di root.

### C4. Tiga sistem styling (P2)

1. `theme.css`: design token semantik (`--surface-card`, `--text-muted`, dan lain-lain) beserta varian dark mode.
2. `components.css`: 5.188 baris CSS klasik (`.bottom-sheet`, `.delete-dialog`, dan lain-lain).
3. Kelas utilitas Tailwind dengan warna palet langsung (`bg-white`, `text-slate-400`, `dark:bg-slate-900`).

Hanya 8 rujukan `var(--token)` di file TSX. Ada juga 26 warna hex dan 32 inline `style={{}}` di TSX. Akibatnya token yang sudah dirancang dengan memperhatikan kontras WCAG jarang dipakai oleh komponen baru, dan dark mode harus ditulis ulang di setiap elemen.

**Perbaikan:** daftarkan token ke Tailwind 4 lewat `@theme` (misalnya `--color-surface: var(--surface-card)`), sehingga komponen memakai `bg-surface text-muted` dan dark mode mengikuti otomatis. Setelah itu `components.css` bisa dikurangi bertahap.

### Lain-lain

- `index.html` memiliki `lang="en"`.
- 12 `console.*` di kode produksi, sebagian adalah `.catch(console.error)` yang menelan error tanpa memberi tahu pengguna (misalnya `ensureUserDefaults`).
- `README.md` masih template Vite. Belum ada dokumentasi setup, env, emulator, dan deploy.

---

## 7. UI/UX

### Yang sudah baik

- Pola mobile yang tepat untuk pencatatan harian: bottom nav dengan FAB tengah, bottom sheet untuk form.
- Tiga cara input (Manual, Ketik, Scan) dengan review sebelum simpan, dan penanda "Perlu dicek" untuk hasil OCR yang meragukan (terlihat di mockup).
- Banner offline yang jelas.
- Disclosure sebelum fitur AI pertama kali dipakai.
- Konfirmasi hapus memakai `<dialog>` native, dengan peringatan khusus untuk transfer.
- Empty state di Beranda punya CTA.

### U1. Dark mode tidak konsisten (P1)

- Hanya 9 dari 39 file TSX non-test yang memakai varian `dark:`.
- Dari 25 pemakaian `bg-white`, hanya 8 yang punya `dark:bg-*` di baris yang sama.
- Contoh di `HomeTab.tsx`: empty state (`bg-slate-50/70`, `bg-white`, `text-slate-800`) dan ikon kategori (`bg-orange-100`, `bg-emerald-100`, dan lain-lain) tidak punya varian dark. Di dark mode, elemen ini muncul sebagai kotak terang di atas latar navy.
- FAB memakai `border-4 border-white`, jadi muncul cincin putih di dark mode.
- Tab nav yang tidak aktif memakai `hover:text-slate-700`, yang membuat teks lebih gelap saat hover di dark mode.

Perbaikan C4 (token lewat `@theme`) menyelesaikan sebagian besar masalah ini sekaligus.

### U2. `alert()` dan `confirm()` native (P1)

Ada 6 `alert()` dan 1 `confirm()`: gagal membuat ledger, tidak ada akun untuk membayar tagihan (dua tempat), gagal menghapus transaksi, gagal menyimpan anggaran, dan gagal reset kuota di admin. Dialog native memblokir halaman, tidak mengikuti tema, dan tampil sebagai dialog browser di PWA.

**Perbaikan:** satu komponen toast (token `--z-toast` sudah ada) untuk error, dan untuk kasus "tidak ada akun kas/bank", tampilkan pesan di dalam sheet dengan tombol langsung ke "Tambah Akun".

### U3. Klaim privasi di mockup (P1)

`mockup-preview.html` menampilkan "Foto diproses di perangkatmu, tidak diunggah." Implementasinya mengirim gambar sebagai base64 `inlineData` ke Gemini (`geminiService.ts:35`). Disclosure di aplikasi sendiri sudah jujur ("menggunakan Google Gemini AI"). Jika mockup menjadi acuan refresh UI, copy ini jangan ikut dipakai. Ganti dengan sesuatu seperti "Foto dikirim ke Google Gemini untuk dibaca, tidak disimpan oleh Catat" (sesuaikan dengan kebijakan retensi yang berlaku).

### U4. Keterbacaan dan target sentuh (P2)

- `text-slate-400` (#94a3b8) di atas putih punya rasio kontras sekitar 2,6:1, di bawah batas WCAG AA 4,5:1 untuk teks normal. Kelas ini dipakai 40 kali, termasuk label tab nav yang tidak aktif dan subtitle transaksi. Ganti dengan `text-slate-500` (#64748b, sekitar 4,8:1) atau token `--text-muted`.
- 62 pemakaian ukuran font 8 sampai 11px (`text-[9px]`, `text-[10px]`, `text-[11px]`). Subtitle transaksi, label nav, dan badge berada di 9 sampai 10px. Disarankan minimal 12px untuk teks yang perlu dibaca.
- Tombol duplikat, ubah, dan hapus di setiap baris transaksi berukuran sekitar 20x20px (`p-1` dengan ikon 12px) dan berdempetan. Ini di bawah minimum WCAG 2.5.8 (24x24px) dan jauh di bawah rekomendasi Apple HIG (44pt). Tombol hapus di sebelah tombol ubah juga rawan salah tekan. Saran: tap baris untuk membuka detail, lalu pindahkan aksi ke sheet detail atau menu swipe/long-press.
- Ikon kategori pastel (misalnya orange-600 di atas orange-100, sekitar 3,1:1) lolos batas 3:1 untuk elemen non-teks, tapi tipis. Lebih penting lagi, warnanya ditebak dari nama kategori (`name.includes('Makan')`), jadi kategori buatan pengguna selalu biru. Simpan `color` di dokumen kategori.

### U5. Aksesibilitas bottom sheet (P2)

- Bottom sheet dibuat dari `<div>` dengan `onClick` di backdrop. Tidak ada focus trap, tidak ada penanganan Escape (hanya `ProfileMenuPopover` yang punya), dan fokus tidak dikembalikan ke tombol pemicu setelah ditutup.
- `FamilyLedgerSheet` memasang `role="dialog"` di backdrop, bukan di panel sheet.
- Tab nav tidak memakai `aria-current="page"` untuk tab aktif.
- Tidak ada penanganan `prefers-reduced-motion`.
- `lang="en"` membuat screen reader membaca teks Indonesia dengan pelafalan Inggris.

**Perbaikan:** satu komponen `BottomSheet` bersama yang dibangun di atas `<dialog>` native (sudah dipakai untuk dialog hapus). `showModal()` memberi focus trap, Escape, dan `inert` pada konten belakang tanpa library tambahan.

### U6. Bunyi di setiap tap (P2)

`haptic.ts` tidak memakai getaran (`navigator.vibrate`). Fungsi ini membuat bunyi beep lewat `AudioContext` di setiap tap nav, tombol aksi, dan simpan. Belum ada pengaturan untuk mematikannya. Di tempat umum ini bisa mengganggu. Saran: default mati atau ikuti pengaturan, pakai `navigator.vibrate` di perangkat yang mendukung, dan tambahkan toggle di menu profil.

### Catatan UX lain

- Label "Pelacakan Transaksi Harian" terlalu panjang untuk header list. "Transaksi" atau "Riwayat" sudah cukup, ditambah label bulan.
- Status loading hanya berupa teks ("Memuat Catat...", "Memuat data transaksi..."). Skeleton untuk hero card dan list akan terasa lebih cepat.
- Tidak ada pengelompokan transaksi per tanggal. Header per hari ("Hari ini", "Kemarin", "Sen, 3 Nov") dengan subtotal memudahkan pengecekan harian.
- Login hanya Google. Untuk target keluarga, pertimbangkan apakah semua anggota punya akun Google.

---

## 8. Jawaban: fitur baru, revamp, atau revamp UI?

| Opsi | Penilaian |
|---|---|
| Tambah fitur baru sekarang | Tidak disarankan. Fitur baru akan dibangun di atas data yang terpotong (D1) dan ledger yang belum aman (S1, S2). |
| Revamp total (rewrite) | Tidak perlu. Arsitektur `features/` + `lib/`, schema Zod, transaksi atomik, dan token desain sudah benar. Masalahnya ada di titik-titik tertentu, bukan di fondasi. |
| Revamp UI total (redesign) | Tidak perlu. Pola interaksi sudah tepat. Yang dibutuhkan adalah konsistensi dan aksesibilitas. |
| **Perbaikan terarah + refresh UI bertahap** | **Disarankan.** Fase 0 sampai 2 di bawah, lalu fitur baru di Fase 3. |

---

## 9. Roadmap

Estimasi kasar untuk satu developer yang sudah mengenal kodenya.

### Fase 0: Keamanan dan kebenaran data (sekitar 1 minggu)

Implementation plan: [`docs/superpowers/plans/2026-11-09-fase-0-security-and-data-correctness.md`](../superpowers/plans/2026-11-09-fase-0-security-and-data-correctness.md)

- [ ] Cabut dan ganti App Check debug token, keluarkan dari `package.json` (S3)
- [ ] Tulis ulang rules ledger dan pindahkan pencarian kode ke `invites/{code}` (S1, S2)
- [ ] Rule `scanUsage` hanya boleh naik satu per update, aktifkan rate limit AI Logic (S4)
- [ ] Tambahkan test rules untuk skenario penyerang
- [ ] Ganti query 50 transaksi dengan query per bulan + pagination riwayat; export CSV dari query sendiri (D1)
- [ ] Satu sumber `selectedMonth` untuk Beranda, Anggaran, dan Statistik (D3)
- [ ] Perbaiki test yang bergantung tanggal (T1)

### Fase 1: Refresh UI (sekitar 2 minggu)

- [ ] Daftarkan token `theme.css` ke Tailwind lewat `@theme`, lalu migrasi komponen ke kelas semantik, dimulai dari Beranda, BottomNav, dan Header (C4, U1)
- [ ] Komponen `Toast`, ganti semua `alert()`/`confirm()` (U2)
- [ ] Komponen `BottomSheet` bersama berbasis `<dialog>` (U5)
- [ ] Minimum font 12px, ganti `text-slate-400` untuk teks, `lang="id"` (U4, U5)
- [ ] Baris transaksi: tap untuk detail, aksi dipindah ke sheet detail, pengelompokan per tanggal (U4)
- [ ] Hidupkan kembali search dan filter di Beranda (D2)
- [ ] Warna kategori disimpan di data (U4)
- [ ] Toggle bunyi/getaran (U6)
- [ ] Perbaiki copy privasi sebelum mockup dipakai (U3)
- [ ] Jalankan `axe-core` (sudah ada di devDependencies) dan screenshot showcase untuk light dan dark mode sebagai pemeriksaan akhir

### Fase 2: Struktur kode (sekitar 1 minggu, bisa paralel dengan Fase 1)

- [ ] Pecah `DashboardView`, `TransactionFormSheet`, `ReceiptScanTab`, `ManageSheet` (C1)
- [ ] Bereskan 32 warning lint, dimulai dari `immutability`, `exhaustive-deps`, dan `purity` (C2)
- [ ] Hapus dead code: 4 komponen, 77 kelas CSS, manifest ganda, file mockup di root (C3)
- [ ] Migrasi test ke `test()`/`describe()` dari `bun:test` (T1)
- [ ] Ganti daftar email admin dengan `system_admins`/custom claims (S5)
- [ ] Validasi bentuk data transaksi di rules (C5)
- [ ] Tulis README: setup, env, emulator, test, deploy

### Fase 3: Kandidat fitur baru

Diurutkan dari yang paling dekat dengan kode yang sudah ada:

1. **Transaksi berulang** (gaji, langganan, cicilan). Struktur `dueDay` di akun dan `prepareTransactionDuplicate` bisa dipakai ulang.
2. **Pengingat tagihan** lewat notifikasi push. `bills.ts` sudah menghitung tagihan yang akan jatuh tempo, dan service worker sudah ada.
3. **Laporan bulanan** (ringkasan akhir bulan, perbandingan dengan bulan lalu). Butuh agregat bulanan dari perbaikan D1.
4. **Anggaran per anggota keluarga** atau siapa membayar apa. `createdBy` sudah tersimpan di setiap transaksi.
5. **Backup dan restore** (export/import JSON penuh), memperluas export CSV yang sudah ada.

---

## 10. Koreksi dari analisa sebelumnya

- Sebelumnya saya menyebut warna ikon kategori pastel "belum tentu lolos AA". Setelah dihitung, ikon tersebut lolos batas 3:1 untuk elemen non-teks, meski tipis. Masalah kontras yang lebih nyata ada pada `text-slate-400` untuk teks (sekitar 2,6:1).
- Sebelumnya saya menyebut codebase ini "well-tested". Cakupannya memang luas, tapi saat ini suite gagal (T1) dan format test-nya membuat hasil tidak granular.
- Analisa sebelumnya belum mencakup S1 sampai S4 dan D1 sampai D3. Temuan ini mengubah prioritas: keamanan dan kebenaran data harus didahulukan sebelum refresh UI.
