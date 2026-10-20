# Super Admin & AI Resource Telemetry Design Document

## 1. Overview
Catat memanfaatkan model AI Google Gemini (`gemini-3.5-flash-lite` dan fallback `gemini-3.5-flash`) untuk pemindaian struk digital/fisik (OCR) serta asisten input pencatatan transaksi teks alami (NLP). Seiring berkembangnya pemakaian, ketiadaan visibilitas agregat atas konsumsi token, latensi model, tingkat kegagalan (*fallback/error rate*), dan aktivitas pengguna menimbulkan potensi lonjakan biaya dan risiko operasional.

Fitur **Super Admin & AI Resource Telemetry** menyediakan dashboard operasional terintegrasi di Catat (`/admin`) yang memungkinkan Super Admin untuk:
1. Memantau konsumsi sumber daya AI secara *real-time* (total panggilan, latensi, rasio sukses/fallback/error, estimasi token & biaya).
2. Memeriksa riwayat *audit log* telemetri AI terperinci.
3. Memantau direktori pengguna aktif dan buku kas keluarga (*Family Ledgers*), termasuk kemampuan mereset kuota harian pengguna tertentu jika diperlukan.
4. Mengendalikan sistem secara dinamis melalui *Dynamic Configuration* (mengubah batas kuota scan harian, memilih model default Gemini, dan mengaktifkan *emergency kill-switch* untuk AI tanpa perlu melakukan *re-deploy*).

---

## 2. Architecture & Access Control

### 2.1 Role & Security Model
* **Identifikasi Super Admin**:
  * Ditentukan melalui keberadaan dokumen di koleksi `system_admins/{uid}`.
  * Field dokumen:
    * `uid`: string (ID unik user dari Firebase Auth)
    * `email`: string
    * `role`: `'superadmin'`
    * `addedAt`: number (timestamp epoch ms)
* **Firestore Security Rules**:
  * Helper `isSuperAdmin()`:
    ```javascript
    function isSuperAdmin() {
      return isAuthenticated() && exists(/databases/$(database)/documents/system_admins/$(request.auth.uid));
    }
    ```
  * Koleksi `system_config`:
    * `allow read: if isAuthenticated();` (klien umum perlu membaca kuota aktif & status AI).
    * `allow write: if isSuperAdmin();` (hanya admin yang dapat mengubah konfigurasi sistem).
  * Koleksi `ai_logs`:
    * `allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;` (klien mencatat log miliknya sendiri secara *fire-and-forget*).
    * `allow read, delete: if isSuperAdmin();` (hanya admin yang dapat membaca dan membersihkan log).
  * Koleksi `users` & `ledgers`:
    * `allow read: if isSuperAdmin() || ...;` (admin dapat melakukan listing direktori pengguna dan buku kas).

### 2.2 Routing & Navigation
* **Client-Side Guard (`useSuperAdmin`)**:
  * Memeriksa dokumen `system_admins/{uid}` secara real-time via `onSnapshot` / `getDoc`.
  * Mengekspos `{ isSuperAdmin: boolean, loading: boolean }`.
* **Navigasi**:
  * Ditambahkan ke `HeaderProfileMenu.tsx`: tombol **"Admin Dashboard"** dengan ikon `ShieldCheck` hanya tampil jika `isSuperAdmin === true`.
  * Saat diklik, aplikasi berganti tampilan ke `admin` (`currentView === 'admin'`).
  * Jika pengguna non-admin mencoba memuat tampilan admin, sistem memblokir akses dan mengembalikan pengguna ke dashboard transaksi utama.

---

## 3. Data Schema & Collections

### 3.1 `system_config/global`
Dokumen tunggal yang menyimpan konfigurasi operasional runtime:
```typescript
export interface SystemConfig {
  dailyOcrLimit: number; // default: 20
  defaultOcrModel: string; // default: 'gemini-3.5-flash-lite'
  fallbackOcrModel: string; // default: 'gemini-3.5-flash'
  aiKillSwitch: boolean; // default: false (true = matikan semua AI)
  updatedAt: string; // ISO 8601
  updatedBy: string; // UID atau email admin
}
```

### 3.2 `ai_logs/{logId}`
Dokumen log per panggilan fitur AI:
```typescript
export interface AiLogEntry {
  id: string;
  timestamp: number; // epoch ms
  dateKey: string; // YYYY-MM-DD
  uid: string;
  userEmail: string;
  feature: 'ocr' | 'nlp';
  model: string;
  durationMs: number;
  status: 'success' | 'fallback' | 'error';
  tokensUsed?: {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
  };
  errorMsg?: string | null;
}
```

### 3.3 Enhanced `users/{uid}`
Memperbarui fungsi `ensureUserDefaults` di `src/features/auth/seedDefaults.ts` agar saat login, metadata pengguna disimpan ke Firestore:
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastActiveAt: number;
  createdAt: number;
  seeded: boolean;
}
```

---

## 4. Services & Implementation Details

### 4.1 Telemetry Service (`src/lib/telemetry/telemetryService.ts`)
* `logAiUsage(payload: Omit<AiLogEntry, 'id' | 'timestamp' | 'dateKey'>): Promise<void>`
  * *Fire-and-forget*: dibungkus blok `try/catch`. Tidak pernah melempar *exception* yang menghentikan alur aplikasi pengguna.
  * Menulis dokumen ke koleksi `ai_logs`.
* `subscribeAiLogs(callback: (logs: AiLogEntry[]) => void, limitCount?: number): () => void`
  * Berlangganan log terbaru diurutkan dari `timestamp` desc.
* `getAiTelemetrySummary(logs: AiLogEntry[]): AiTelemetrySummary`
  * Menghitung total pemanggilan, jumlah sukses, rasio fallback, rasio error, rata-rata durasi dalam ms, dan estimasi total token.

### 4.2 Dynamic Config Service (`src/lib/config/systemConfigService.ts`)
* `getSystemConfig(): Promise<SystemConfig>`
  * Membaca `system_config/global` dengan *safe fallback* ke konstanta lokal jika dokumen belum ada atau koneksi gagal.
* `subscribeSystemConfig(callback: (config: SystemConfig) => void): () => void`
  * Mendengarkan perubahan konfigurasi runtime secara live.
* `updateSystemConfig(updates: Partial<SystemConfig>, adminUid: string): Promise<void>`
  * Memperbarui dokumen konfigurasi di Firestore.
* Hook React: `useSystemConfig()`
  * Menyediakan status konfigurasi terkini kepada komponen aplikasi.

### 4.3 Integration Points
* **`geminiService.ts`**:
  * Pengecekan limit kuota harian di `checkScanQuota` & `incrementScanUsage` menggunakan `dailyOcrLimit` dari `systemConfig` (bukan konstanta statis).
  * Evaluasi `aiKillSwitch`: Jika aktif, batalkan pemanggilan Gemini dan beri keterangan bahwa fitur AI sedang dinonaktifkan sementara oleh sistem.
  * Pengukuran durasi dengan `performance.now()`.
  * Pencatatan telemetri melalui `logAiUsage` pada saat sukses, fallback, maupun error.
* **`textAssistantService.ts`**:
  * Pengecekan `aiKillSwitch` sebelum menjalankan parser Gemini.
  * Pencatatan telemetri melalui `logAiUsage` pada saat eksekusi NLP.

---

## 5. User Interface (`AdminDashboardView.tsx`)

Desain mengadopsi tema gelap modern *Obsidian* Catat (`bg-stone-950`, border `stone-800`, aksen emerald & amber):
1. **Header Panel**:
   * Label "Catat Super Admin Hub".
   * Indikator status sistem: *Normal* (hijau) atau *AI Suspended* (merah).
   * Tombol cepat kembali ke Catat Dashboard.
2. **Tab Bar**:
   * **Tab 1: AI Telemetry**:
     * 4 KPI Cards:
       1. Total AI Calls (pembagian OCR vs NLP).
       2. Success Rate (% sukses, % fallback, % error).
       3. Average Latency (ms).
       4. Token Estimation (total prompt & completion).
     * Filter Bar: Filter status (All, Success, Fallback, Error) & Pencarian Email User.
     * Tabel Audit Log Real-time: Waktu, User, Fitur, Model, Durasi, Status Badge, Pesan Masalah (jika ada).
   * **Tab 2: Users & Ledgers**:
     * Tabel Direktori Pengguna: Avatar/Nama, Email, Tanggal Daftar, Terakhir Aktif, Penggunaan Kuota Hari Ini (`X / Limit`).
     * Tombol Aksi per User: *"Reset Kuota Hari Ini"* (mereset dokumen `scanUsage/{uid}_{dateKey}`).
     * Ringkasan Family Ledgers: Nama ledger, Pemilik, Jumlah Anggota.
   * **Tab 3: System Controls**:
     * Form pengaturan limit harian scan OCR (`dailyOcrLimit`).
     * Dropdown pilihan model Gemini default (`gemini-3.5-flash-lite` vs `gemini-3.5-flash`).
     * Toggle *AI Kill-Switch* dengan dialog konfirmasi.
     * Tombol Simpan Konfigurasi dengan notifikasi sukses.

---

## 6. Testing & Quality Assurance

1. **Firestore Rules Tests (`tests/firestore.rules.test.ts`)**:
   * Verifikasi user biasa ditolak membaca `ai_logs` dan ditolak menulis `system_config`.
   * Verifikasi Super Admin sukses membaca dan menulis ke koleksi terkait.
2. **Unit Tests**:
   * `telemetryService.test.ts`: Pengujian pencatatan log tidak memblokir aplikasi bila terjadi kegagalan jaringan.
   * `systemConfigService.test.ts`: Pengujian nilai fallback jika Firestore belum diinisialisasi.
   * `AdminDashboardView.test.ts`: Pengujian rendering tab, KPI cards, dan filtering log.
3. **Regression Suite**:
   * Menjalankan `bun test src/` untuk memastikan tidak ada fitur atau uji regresi sebelumnya yang terganggu.
