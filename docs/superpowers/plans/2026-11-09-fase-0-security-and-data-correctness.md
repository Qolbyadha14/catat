# Fase 0: Keamanan & Kebenaran Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup celah keamanan P0/P1 dan memperbaiki perhitungan yang salah dari review [`docs/review/2026-11-09-catat-product-review.md`](../../review/2026-11-09-catat-product-review.md): S1, S2, S3, S4, D1, D3, T1, ditambah sebagian S5 (pembacaan `system_admins`).

**Architecture:**
- App Check debug token hanya dipasang di Vite dev dan test, tidak pernah di build produksi.
- Pencarian kode undangan pindah ke koleksi baru `invites/{code}` → `{ ledgerId, createdAt }`. Koleksi ini hanya bisa di-`get` per kode, tidak bisa di-list. Dokumen `ledgers/{id}` hanya bisa dibaca anggota. Calon anggota hanya boleh menambahkan entry miliknya sendiri, dengan role `member`, dan harus menyertakan `joinCode` yang sama dengan `inviteCode` ledger.
- `scanUsage.count` hanya boleh naik +1 per tulis, dengan batas dari `system_config/global.dailyOcrLimit`.
- Data transaksi di-query per bulan (`date` dalam `[awal bulan, awal bulan berikutnya)`) tanpa batas 50 item. Beranda, Anggaran, Statistik, Search, dan export CSV memakai bulan yang sama.

**Tech Stack:** React 19, TypeScript 6, Firebase JS SDK 13 (Firestore, App Check, AI Logic), Firestore Security Rules v2, `@firebase/rules-unit-testing`, Bun test, Vite 8.

## Global Constraints

- **Jangan deploy dari plan ini.** Deploy rules dan hosting dilakukan manual oleh pemilik project lewat Task 11, dengan urutan yang ditentukan di sana.
- **Rules dan client harus di-deploy bersamaan.** Client lama memakai query `ledgers where inviteCode ==`, yang ditolak rules baru. Client baru memakai `invites/{code}`, yang ditolak rules lama.
- **Tidak ada composite index baru.** Range + `orderBy` pada field yang sama (`date`) dan equality tunggal (`referenceKey`) memakai single-field index otomatis.
- **Kompatibilitas data:** dokumen ledger, anggota, dan transaksi yang sudah ada tidak dimigrasi. Indeks `invites/{code}` untuk ledger lama dibuat otomatis saat owner membuka aplikasi (Task 6).
- **Test baru memakai `describe`/`it`/`test` dari `bun:test`**, bukan `assert()` di top level.
- **Firestore menolak nilai `undefined`.** Jangan menulis field opsional bernilai `undefined` (misalnya `photoURL`).
- Menjalankan rules/e2e test butuh Java: script `test:rules` dan `test:e2e` sudah menambahkan `/opt/homebrew/opt/openjdk@25/bin` ke `PATH`.

## File Map

| File | Aksi | Task |
|---|---|---|
| `src/lib/firebase.ts` | Modify | 1 |
| `package.json` | Modify | 1 |
| `tests/ocr-live.test.ts` | Modify | 1, 3 |
| `tests/firestore.rules.test.ts` | Modify | 2, 3 |
| `firestore.rules` | Modify | 2, 3 |
| `src/lib/schemas.ts` | Modify | 4 |
| `src/lib/ledgerService.ts` | Modify | 4, 9 |
| `src/lib/ledgerService.test.ts` | Modify | 4, 9 |
| `src/features/family/family.test.ts` | Modify | 4 |
| `tests/e2e-gates.test.ts` | Modify | 4, 10 |
| `src/features/family/FamilyLedgerSheet.tsx` | Modify | 5 |
| `src/features/dashboard/DashboardView.tsx` | Modify | 6, 8 |
| `src/lib/transactionFilter.ts` | Modify | 7 |
| `src/lib/transactionFilter.test.ts` | Modify | 7 |
| `src/lib/transactionRange.ts` | Create | 8 |
| `src/lib/transactionRange.test.ts` | Create | 8 |
| `src/features/transactions/transactionQueries.ts` | Create | 8 |
| `src/features/transactions/useTransactions.ts` | Rewrite | 8 |
| `src/features/budgets/BudgetsTab.tsx` | Modify | 9 |
| `src/features/analytics/StatsTab.tsx` | Modify | 9 |
| `src/components/modals/SearchModal.tsx` | Modify | 9 |
| `src/features/dashboard/HomeTab.tsx` | Modify | 9 |
| `src/features/transactions/TransactionFormSheet.tsx` | Modify | 9 |

---

### Task 1: Hentikan pengiriman App Check debug token ke produksi (S3)

**Konteks:** `.env` berisi `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`. `src/lib/firebase.ts` memasang token itu tanpa mengecek mode, sehingga bundle produksi `dist/assets/index-TcwpGAE0.js` (yang tercatat di `.firebase/hosting.ZGlzdA.cache`) berisi `self.FIREBASE_APPCHECK_DEBUG_TOKEN="<uuid>"`. Akibatnya setiap pengunjung produksi memakai debug provider, dan token itu terbuka untuk publik. Token yang sama juga tertulis di `package.json` dan `tests/ocr-live.test.ts`.

**Files:**
- Modify: `src/lib/firebase.ts`
- Modify: `package.json`
- Modify: `tests/ocr-live.test.ts`

- [ ] **Step 1: Buktikan masalahnya dengan build saat ini**

Run:
```bash
bun run build && grep -cE 'FIREBASE_APPCHECK_DEBUG_TOKEN=.?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-' dist/assets/*.js
```
Expected: angka `1` atau lebih (token ikut ter-bundle).

- [ ] **Step 2: Ganti blok App Check di `src/lib/firebase.ts`**

Ganti seluruh blok mulai `export let appCheck: AppCheck | undefined;` sampai akhir file dengan:

```ts
export let appCheck: AppCheck | undefined;

/**
 * Debug token hanya boleh dipakai di Vite dev dan di test runner.
 * Vite mengganti `import.meta.env.DEV` dengan `false` saat build produksi,
 * sehingga cabang pertama (beserta nilai token dari .env) dibuang dari bundle.
 */
function resolveAppCheckDebugToken(): string | boolean | undefined {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
  }
  if (isTest) {
    return (
      proc?.env?.FIREBASE_APPCHECK_DEBUG_TOKEN ??
      proc?.env?.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN ??
      (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN
    );
  }
  return undefined;
}

if (typeof window !== 'undefined') {
  const debugToken = resolveAppCheckDebugToken();
  if (debugToken) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // ponytail: ignore duplicate init or missing DOM during dev hot-reload
    if (isDev) {
      console.warn('[firebase] AppCheck init notice:', err);
    }
  }
}
```

- [ ] **Step 3: Hapus token dari `package.json`**

Ganti script `test:ocr-live` menjadi:

```json
"test:ocr-live": "export PATH=\"/opt/homebrew/opt/openjdk@25/bin:$PATH\" && firebase emulators:exec --only auth,firestore \"bun test tests/ocr-live.test.ts\"",
```

Token sekarang dibaca dari environment. Bun otomatis memuat `.env`, yang sudah berisi `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`.

- [ ] **Step 4: Hapus token literal dari `tests/ocr-live.test.ts`**

Ganti baris 16–18:

```ts
// Ensure debug token is wired
const DEBUG_TOKEN = process.env.FIREBASE_APPCHECK_DEBUG_TOKEN || '51561ED6-6CB7-4A7B-9068-C845B5E7AE4F';
(globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN;
```

dengan:

```ts
// Token dibaca dari environment (.env atau shell), tidak pernah ditulis di repo
const DEBUG_TOKEN =
  process.env.FIREBASE_APPCHECK_DEBUG_TOKEN ?? process.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
if (!DEBUG_TOKEN) {
  throw new Error(
    'Set FIREBASE_APPCHECK_DEBUG_TOKEN (atau VITE_FIREBASE_APPCHECK_DEBUG_TOKEN di .env) sebelum menjalankan test:ocr-live'
  );
}
(globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN;
```

Lalu ganti isi test `'1. App Check Debug Token: properly wired to environment'`:

```ts
  it('1. App Check Debug Token: properly wired to environment', () => {
    expect(DEBUG_TOKEN).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i);
    expect((globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN)
      .toBe(DEBUG_TOKEN);
    expect(DEFAULT_OCR_MODEL).toBe('gemini-3.5-flash-lite');
  });
```

- [ ] **Step 5: Verifikasi build tidak lagi berisi token**

Run:
```bash
bun run build && grep -cE 'FIREBASE_APPCHECK_DEBUG_TOKEN=.?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-' dist/assets/*.js; grep -rn '51561ED6' package.json tests src
```
Expected: `grep -c` mencetak `0` untuk setiap file, dan `grep -rn` tidak mencetak apa pun.

- [ ] **Step 6: Verifikasi dev mode masih memakai debug token**

Run: `bun run dev`, buka `http://localhost:5173`, lalu di DevTools Console jalankan `self.FIREBASE_APPCHECK_DEBUG_TOKEN`.
Expected: nilai token dari `.env`, atau `true` jika variabel itu kosong.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase.ts package.json tests/ocr-live.test.ts
git commit -m "fix(security): never ship App Check debug token in production builds"
```

> Token lama tetap ada di riwayat git dan di bundle yang sedang live. Pencabutan token dilakukan di Task 11 **setelah** build baru ter-deploy. Jika dicabut lebih dulu, semua pengunjung yang masih memakai bundle lama gagal App Check.

---

### Task 2: Rules ledger dan indeks undangan (S1, S2, sebagian S5)

**Files:**
- Modify: `tests/firestore.rules.test.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Perbarui import di `tests/firestore.rules.test.ts`**

Ganti:
```ts
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
```
dengan:
```ts
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
```

- [ ] **Step 2: Tambahkan test admin di dalam `describe('Firestore Security Rules: Super Admin, System Config, and AI Telemetry Logs', ...)`**

Tambahkan setelah test `'Super admin can read ai_logs, list users, and list ledgers'`:

```ts
    it('Daftar admin tidak bisa dibaca user biasa; tiap user hanya bisa membaca dokumen adminnya sendiri', async () => {
      const regularDb = testEnv.authenticatedContext('user-regular').firestore();
      await assertFails(getDoc(doc(regularDb, 'system_admins/user-admin')));
      await assertFails(getDocs(collection(regularDb, 'system_admins')));
      await assertSucceeds(getDoc(doc(regularDb, 'system_admins/user-regular')));

      const adminDb = testEnv.authenticatedContext('user-admin').firestore();
      await assertSucceeds(getDoc(doc(adminDb, 'system_admins/user-admin')));
    });
```

- [ ] **Step 3: Tambahkan blok test ledger di akhir file (top level)**

```ts
describe('Family Ledger & Invite Guard', () => {
  const OWNER = 'owner-a';
  const MEMBER = 'member-b';
  const OUTSIDER = 'outsider-c';
  const CODE = 'ABC234';

  const ownerEntry = { uid: OWNER, name: 'Owner', email: 'o@test.com', role: 'owner', joinedAt: 1 };
  const memberEntry = { uid: MEMBER, name: 'Member', email: 'm@test.com', role: 'member', joinedAt: 2 };
  const outsiderEntry = { uid: OUTSIDER, name: 'Outsider', email: '', joinedAt: 3 };

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const rootDb = context.firestore();
      await setDoc(doc(rootDb, `ledgers/${OWNER}`), {
        id: OWNER,
        name: 'Keluarga A',
        ownerUid: OWNER,
        inviteCode: CODE,
        members: { [OWNER]: ownerEntry, [MEMBER]: memberEntry },
        createdAt: 1,
        updatedAt: 1,
      });
      await setDoc(doc(rootDb, `invites/${CODE}`), { ledgerId: OWNER, createdAt: 1 });
      await setDoc(doc(rootDb, `ledgers/${OWNER}/transactions/tx_1`), { amount: 1000 });
    });
  });

  it('Non-anggota tidak bisa membaca ledger, me-list ledger, atau membaca transaksinya', async () => {
    const outsiderDb = testEnv.authenticatedContext(OUTSIDER).firestore();
    await assertFails(getDoc(doc(outsiderDb, `ledgers/${OWNER}`)));
    await assertFails(getDocs(query(collection(outsiderDb, 'ledgers'), where('inviteCode', '==', CODE))));
    await assertFails(getDoc(doc(outsiderDb, `ledgers/${OWNER}/transactions/tx_1`)));
  });

  it('Kode undangan bisa diambil per kode tapi tidak bisa di-list', async () => {
    const outsiderDb = testEnv.authenticatedContext(OUTSIDER).firestore();
    await assertSucceeds(getDoc(doc(outsiderDb, `invites/${CODE}`)));
    await assertFails(getDocs(collection(outsiderDb, 'invites')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), `invites/${CODE}`)));
  });

  it('Join tanpa kode, dengan kode salah, atau sebagai owner ditolak', async () => {
    const ref = doc(testEnv.authenticatedContext(OUTSIDER).firestore(), `ledgers/${OWNER}`);
    await assertFails(updateDoc(ref, { [`members.${OUTSIDER}`]: { ...outsiderEntry, role: 'member' }, updatedAt: 3 }));
    await assertFails(
      updateDoc(ref, { [`members.${OUTSIDER}`]: { ...outsiderEntry, role: 'member', joinCode: 'WRONG9' }, updatedAt: 3 })
    );
    await assertFails(
      updateDoc(ref, { [`members.${OUTSIDER}`]: { ...outsiderEntry, role: 'owner', joinCode: CODE }, updatedAt: 3 })
    );
  });

  it('Join dengan kode yang benar sebagai member diizinkan, lalu transaksi bisa dibaca', async () => {
    const outsiderDb = testEnv.authenticatedContext(OUTSIDER).firestore();
    await assertSucceeds(
      updateDoc(doc(outsiderDb, `ledgers/${OWNER}`), {
        [`members.${OUTSIDER}`]: { ...outsiderEntry, role: 'member', joinCode: CODE },
        updatedAt: 3,
      })
    );
    await assertSucceeds(getDoc(doc(outsiderDb, `ledgers/${OWNER}/transactions/tx_1`)));
  });

  it('Calon anggota tidak bisa menghapus atau menambahkan anggota lain', async () => {
    const ref = doc(testEnv.authenticatedContext(OUTSIDER).firestore(), `ledgers/${OWNER}`);
    await assertFails(updateDoc(ref, { [`members.${MEMBER}`]: deleteField(), updatedAt: 3 }));
    await assertFails(
      updateDoc(ref, {
        [`members.${OUTSIDER}`]: { ...outsiderEntry, role: 'member', joinCode: CODE },
        'members.ghost-d': { uid: 'ghost-d', name: 'Ghost', email: '', role: 'member', joinedAt: 3, joinCode: CODE },
        updatedAt: 3,
      })
    );
  });

  it('Anggota hanya boleh mengubah atau menghapus entry miliknya sendiri', async () => {
    const ref = doc(testEnv.authenticatedContext(MEMBER).firestore(), `ledgers/${OWNER}`);
    await assertFails(updateDoc(ref, { ownerUid: MEMBER }));
    await assertFails(updateDoc(ref, { inviteCode: 'NEW234' }));
    await assertFails(updateDoc(ref, { [`members.${OWNER}`]: deleteField() }));
    await assertFails(updateDoc(ref, { [`members.${MEMBER}.role`]: 'owner' }));
    await assertSucceeds(updateDoc(ref, { [`members.${MEMBER}.name`]: 'Member Baru', updatedAt: 4 }));
    await assertSucceeds(updateDoc(ref, { [`members.${MEMBER}`]: deleteField(), updatedAt: 5 }));
  });

  it('Owner boleh mengelola anggota dan kode, tapi tidak boleh memindahkan kepemilikan', async () => {
    const ref = doc(testEnv.authenticatedContext(OWNER).firestore(), `ledgers/${OWNER}`);
    await assertFails(updateDoc(ref, { ownerUid: MEMBER }));
    await assertSucceeds(updateDoc(ref, { [`members.${MEMBER}`]: deleteField(), updatedAt: 6 }));
    await assertSucceeds(updateDoc(ref, { inviteCode: 'NEW234', updatedAt: 7 }));
  });

  it('Ledger hanya bisa dibuat dengan ID = UID pembuat dan tanpa anggota lain', async () => {
    const outsiderDb = testEnv.authenticatedContext(OUTSIDER).firestore();
    const entry = { ...outsiderEntry, role: 'owner' };
    const base = { name: 'Keluarga C', ownerUid: OUTSIDER, inviteCode: 'CCC234', createdAt: 1, updatedAt: 1 };

    await assertFails(setDoc(doc(outsiderDb, 'ledgers/victim-z'), { ...base, id: 'victim-z', members: { [OUTSIDER]: entry } }));
    await assertFails(
      setDoc(doc(outsiderDb, `ledgers/${OUTSIDER}`), {
        ...base,
        id: OUTSIDER,
        members: { [OUTSIDER]: entry, 'ghost-d': { ...memberEntry, uid: 'ghost-d' } },
      })
    );
    await assertSucceeds(setDoc(doc(outsiderDb, `ledgers/${OUTSIDER}`), { ...base, id: OUTSIDER, members: { [OUTSIDER]: entry } }));
  });

  it('Hanya owner yang bisa membuat dan menghapus indeks undangan, dan kodenya harus cocok dengan ledger', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
    const batch = writeBatch(ownerDb);
    batch.update(doc(ownerDb, `ledgers/${OWNER}`), { inviteCode: 'NEW234', updatedAt: 8 });
    batch.set(doc(ownerDb, 'invites/NEW234'), { ledgerId: OWNER, createdAt: 8 });
    batch.delete(doc(ownerDb, `invites/${CODE}`));
    await assertSucceeds(batch.commit());

    await assertFails(setDoc(doc(ownerDb, 'invites/FAKE23'), { ledgerId: OWNER, createdAt: 9 }));
    await assertFails(setDoc(doc(ownerDb, 'invites/NEW234'), { ledgerId: OWNER, createdAt: 9 }));

    const memberDb = testEnv.authenticatedContext(MEMBER).firestore();
    await assertFails(setDoc(doc(memberDb, 'invites/MEM234'), { ledgerId: OWNER, createdAt: 9 }));

    const outsiderDb = testEnv.authenticatedContext(OUTSIDER).firestore();
    await assertFails(deleteDoc(doc(outsiderDb, 'invites/NEW234')));
  });
});
```

- [ ] **Step 4: Jalankan rules test, pastikan test baru gagal**

Run: `bun run test:rules`
Expected: FAIL. Paling tidak test "Non-anggota tidak bisa membaca ledger...", "Join tanpa kode...", "Ledger hanya bisa dibuat...", "Kode undangan bisa diambil...", dan test admin gagal.

- [ ] **Step 5: Ganti blok `system_admins` dan `ledgers`, lalu tambahkan `invites` di `firestore.rules`**

Ganti blok `match /system_admins/{adminUid} { ... }` dengan:

```
    // System Admins: tiap user hanya bisa memeriksa dokumen miliknya sendiri
    match /system_admins/{adminUid} {
      allow get: if isAuthenticated() && request.auth.uid == adminUid;
      allow list: if isSuperAdmin();
      allow write: if false;
    }
```

Ganti bagian atas blok `match /ledgers/{ledgerId} { ... }` (semua baris sebelum `match /accounts/{accountId}`) dengan:

```
    // Collaborative Family Ledgers
    match /ledgers/{ledgerId} {
      function isLedgerOwner() {
        return isAuthenticated() && resource.data.ownerUid == request.auth.uid;
      }
      function changedKeys() {
        return request.resource.data.diff(resource.data).affectedKeys();
      }
      function onlyOwnMemberEntryChanged() {
        return changedKeys().hasOnly(['members', 'updatedAt'])
          && request.resource.data.members.diff(resource.data.members).affectedKeys().hasOnly([request.auth.uid]);
      }
      function ownEntryAfter() {
        return request.resource.data.members[request.auth.uid];
      }

      allow read: if isSuperAdmin() || isLedgerMember(ledgerId);

      // ID ledger harus sama dengan UID pembuat agar ledger orang lain tidak bisa "diduduki" lebih dulu
      allow create: if isAuthenticated()
        && ledgerId == request.auth.uid
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.members.keys().hasOnly([request.auth.uid]);

      allow update: if
        // Owner: boleh mengelola anggota, nama, dan kode undangan, tapi tidak boleh memindahkan kepemilikan
        (isLedgerOwner() && !changedKeys().hasAny(['ownerUid']))
        // Anggota: hanya boleh mengubah atau menghapus entry miliknya sendiri, tanpa menaikkan role
        || (isAuthenticated()
            && !isLedgerOwner()
            && request.auth.uid in resource.data.members
            && onlyOwnMemberEntryChanged()
            && (!(request.auth.uid in request.resource.data.members) || ownEntryAfter().role == 'member'))
        // Calon anggota: hanya boleh menambahkan dirinya sendiri dengan kode undangan yang benar
        || (isAuthenticated()
            && !(request.auth.uid in resource.data.members)
            && onlyOwnMemberEntryChanged()
            && ownEntryAfter().uid == request.auth.uid
            && ownEntryAfter().role == 'member'
            && ownEntryAfter().joinCode == resource.data.inviteCode);

      allow delete: if isLedgerOwner();
```

Blok `match /accounts`, `match /categories`, dan `match /transactions` di dalam ledger tidak diubah.

Tambahkan blok baru tepat setelah penutup `match /ledgers/{ledgerId} { ... }`:

```
    // Indeks kode undangan -> ledgerId. Hanya bisa diambil per kode, tidak bisa di-list.
    match /invites/{code} {
      function ledgerAfter(id) {
        return getAfter(/databases/$(database)/documents/ledgers/$(id)).data;
      }

      allow get: if isAuthenticated();
      allow list: if false;
      allow create: if isAuthenticated()
        && request.resource.data.keys().hasOnly(['ledgerId', 'createdAt'])
        && ledgerAfter(request.resource.data.ledgerId).ownerUid == request.auth.uid
        && ledgerAfter(request.resource.data.ledgerId).inviteCode == code;
      allow update: if false;
      allow delete: if isAuthenticated()
        && get(/databases/$(database)/documents/ledgers/$(resource.data.ledgerId)).data.ownerUid == request.auth.uid;
    }
```

`getAfter()` membaca kondisi ledger setelah batch, sehingga rotasi kode (update ledger + buat invite baru dalam satu batch) bisa lolos.

- [ ] **Step 6: Jalankan rules test, pastikan semua lulus**

Run: `bun run test:rules`
Expected: PASS untuk semua test, termasuk test lama.

- [ ] **Step 7: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.ts
git commit -m "fix(rules): require invite code to join ledgers and restrict ledger reads to members"
```

---

### Task 3: Kuota scan hanya boleh naik +1 (S4)

**Files:**
- Modify: `tests/firestore.rules.test.ts`
- Modify: `firestore.rules`
- Modify: `tests/ocr-live.test.ts`

- [ ] **Step 1: Ganti isi `describe('scanUsage Quota & Isolation Guard', ...)`**

Ganti dua test pertama (`'Update count <= 20 diizinkan untuk pemilik sah'` dan `'Attempt count ke-21 ditolak (permission denied)'`) dengan:

```ts
    it('Create harus dimulai dari 1, lalu hanya boleh naik +1', async () => {
      const dbA = testEnv.authenticatedContext('user-a').firestore();
      const usageRef = doc(dbA, 'scanUsage/user-a_2026-10-17');

      await assertFails(setDoc(usageRef, { uid: 'user-a', count: 5 }));
      await assertSucceeds(setDoc(usageRef, { uid: 'user-a', count: 1 }));
      await assertSucceeds(updateDoc(usageRef, { count: 2 }));
      await assertFails(updateDoc(usageRef, { count: 4 }));
    });

    it('Reset kuota oleh pemilik sendiri ditolak', async () => {
      const dbA = testEnv.authenticatedContext('user-a').firestore();
      const usageRef = doc(dbA, 'scanUsage/user-a_2026-10-17');

      await assertSucceeds(setDoc(usageRef, { uid: 'user-a', count: 1 }));
      await assertSucceeds(updateDoc(usageRef, { count: 2 }));
      await assertFails(updateDoc(usageRef, { count: 0 }));
      await assertFails(updateDoc(usageRef, { count: 1 }));
      await assertFails(deleteDoc(usageRef));
    });

    it('Kenaikan melewati batas harian ditolak (default 20)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'scanUsage/user-a_2026-10-17'), { uid: 'user-a', count: 20 });
      });
      const dbA = testEnv.authenticatedContext('user-a').firestore();
      await assertFails(updateDoc(doc(dbA, 'scanUsage/user-a_2026-10-17'), { count: 21 }));
    });

    it('Batas harian mengikuti system_config/global.dailyOcrLimit', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const rootDb = context.firestore();
        await setDoc(doc(rootDb, 'system_config/global'), { dailyOcrLimit: 30 });
        await setDoc(doc(rootDb, 'scanUsage/user-a_2026-10-17'), { uid: 'user-a', count: 20 });
      });
      const dbA = testEnv.authenticatedContext('user-a').firestore();
      await assertSucceeds(updateDoc(doc(dbA, 'scanUsage/user-a_2026-10-17'), { count: 21 }));
    });
```

Test ketiga yang sudah ada (`'User lain dilarang membaca atau memanipulasi usage milik UID berbeda'`) tetap dipakai tanpa perubahan.

- [ ] **Step 2: Jalankan rules test, pastikan test baru gagal**

Run: `bun run test:rules`
Expected: FAIL pada "Create harus dimulai dari 1...", "Reset kuota...", dan "Batas harian mengikuti system_config...".

- [ ] **Step 3: Ganti blok `match /scanUsage/{usageId} { ... }` di `firestore.rules`**

```
    match /scanUsage/{usageId} {
      function ownsUsage() {
        return isAuthenticated()
          && usageId.matches('^' + request.auth.uid + '_[0-9]{4}-[0-9]{2}-[0-9]{2}$');
      }
      function dailyOcrLimit() {
        return exists(/databases/$(database)/documents/system_config/global)
          ? get(/databases/$(database)/documents/system_config/global).data.get('dailyOcrLimit', 20)
          : 20;
      }

      allow read: if isSuperAdmin() || ownsUsage();
      allow create: if ownsUsage()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.count == 1;
      allow update: if ownsUsage()
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.count == resource.data.count + 1
        && request.resource.data.count <= dailyOcrLimit();
      // Reset kuota hanya lewat admin (UsersLedgersTab memakai deleteDoc)
      allow delete: if isSuperAdmin();
    }
```

Jika emulator menolak operator `? :`, ganti `dailyOcrLimit()` dengan dua kondisi: `(!exists(...) && count <= 20) || (exists(...) && count <= get(...).data.get('dailyOcrLimit', 20))`.

- [ ] **Step 4: Jalankan rules test, pastikan lulus**

Run: `bun run test:rules`
Expected: PASS.

- [ ] **Step 5: Sesuaikan test 6 di `tests/ocr-live.test.ts`**

Test ini menulis `count: 20` langsung, yang sekarang ditolak rules. Ganti seluruh test `'6. Quota Cap: ...'` dengan:

```ts
  it('6. Quota Cap: attempt beyond the limit is blocked before AI invocation and rejected', async () => {
    const usageRef = doc(db, 'scanUsage', `${testUid}_${dateKey}`);

    // Rules menolak lompatan count, jadi menulis count = limit secara langsung harus gagal
    await expect(
      setDoc(usageRef, { uid: testUid, date: dateKey, count: OCR_DAILY_LIMIT, updatedAt: new Date().toISOString() })
    ).rejects.toThrow();

    // Isi kuota lewat jalur resmi, lalu turunkan batas lewat limitOverride agar cepat tercapai
    let used = (await getDoc(usageRef)).data()?.count ?? 0;
    if (used === 0) used = await incrementScanUsage(testUid, testDate);
    const limit = used;

    let quotaErrorThrown = false;
    try {
      await checkScanQuota(testUid, testDate, limit);
    } catch (err) {
      quotaErrorThrown = true;
      expect((err as Error).message).toContain('Batas kuota harian tercapai');
    }
    expect(quotaErrorThrown).toBe(true);

    let incErrorThrown = false;
    try {
      await incrementScanUsage(testUid, testDate, limit);
    } catch (err) {
      incErrorThrown = true;
      expect((err as Error).message).toContain('Batas kuota harian tercapai');
    }
    expect(incErrorThrown).toBe(true);
  });
```

- [ ] **Step 6: Jalankan OCR live test**

Run: `bun run test:ocr-live`
Expected: PASS. Test ini memanggil Gemini sungguhan dan membutuhkan debug token yang valid di `.env`. Jika token sudah dicabut di Task 11 sebelum langkah ini dijalankan, isi `.env` dengan token baru lebih dulu.

- [ ] **Step 7: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.ts tests/ocr-live.test.ts
git commit -m "fix(rules): scan quota can only increase by one up to the configured daily limit"
```

> Rules ini mencegah pengguna me-reset hitungan, tapi tidak mencegah pemanggilan Gemini langsung lewat SDK. Pembatasan itu ada di Task 11 (rate limit per pengguna di Firebase AI Logic). Kuota harian yang benar-benar dijamin server butuh proxy Cloud Function, dan itu di luar Fase 0.

---

### Task 4: Alur undangan lewat `invites/{code}` di client

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/ledgerService.ts`
- Modify: `src/lib/ledgerService.test.ts`
- Modify: `src/features/family/family.test.ts`
- Modify: `tests/e2e-gates.test.ts`

**Interfaces:**
- Produces: `generateUnusedInviteCode(): Promise<string>`, `ensureInviteIndex(ledgerId: string, inviteCode: string): Promise<void>`, `rotateInviteCode(ledger: Ledger): Promise<string>`
- Changes: `createInitialLedger(owner, name?, inviteCode?)`, `joinLedgerByCode(code, user)` (signature sama, implementasi baru), `getLedgerById(id)` mengembalikan `id` dari dokumen
- Removes: `getLedgerByInviteCode`. (`findDuplicateReceipt` baru dihapus di Task 9, saat form berhenti memakainya.)

- [ ] **Step 1: Perbarui test unit invite code**

Di `src/lib/ledgerService.test.ts`, ganti:

```ts
// Stable invite code per user across multiple initial ledger creations
const ledgerAttempt2 = createInitialLedger({ uid: 'u1', displayName: 'Qolby', email: 'q@test.com' });
assert(ledger.inviteCode === ledgerAttempt2.inviteCode, 'invite code remains stable for the same user');
```

dengan:

```ts
// Kode undangan baru acak, tidak diturunkan dari UID, agar tidak bisa ditebak dari ID ledger
const ledgerAttempt2 = createInitialLedger({ uid: 'u1', displayName: 'Qolby', email: 'q@test.com' });
assert(ledger.inviteCode !== ledgerAttempt2.inviteCode, 'invite code is random, not derived from uid');
assert(
  createInitialLedger({ uid: 'u1' }, undefined, 'ABC234').inviteCode === 'ABC234',
  'uses the provided invite code'
);
```

Di `src/features/family/family.test.ts`, ganti `// Test 4`:

```ts
// Test 4: invite code is stable per user
const initialAgain = createInitialLedger({ uid: 'u1', displayName: 'Budi Santoso' });
assert(initial.inviteCode === initialAgain.inviteCode, 'invite code remains stable across sessions for same user');
```

dengan:

```ts
// Test 4: invite code is random per ledger creation
const initialAgain = createInitialLedger({ uid: 'u1', displayName: 'Budi Santoso' });
assert(initial.inviteCode !== initialAgain.inviteCode, 'invite code is not derived from uid');
assert(/^[2-9A-HJ-NP-Z]{6}$/.test(initialAgain.inviteCode), 'random invite code uses the safe charset');
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `bun test src/lib/ledgerService.test.ts src/features/family/family.test.ts`
Expected: FAIL dengan `invite code is random, not derived from uid`.

- [ ] **Step 3: Tambahkan `joinCode` ke `ledgerMemberSchema` di `src/lib/schemas.ts`**

```ts
export const ledgerMemberSchema = z.object({
  uid: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  email: z.string().optional().default(''),
  photoURL: z.string().url().optional(),
  role: z.enum(['owner', 'member']),
  joinedAt: z.number().int(),
  // Kode yang dipakai saat bergabung; diperiksa oleh Firestore rules
  joinCode: z.string().trim().max(8).optional(),
});
```

- [ ] **Step 4: Ubah `src/lib/ledgerService.ts`**

4a. Ganti import Firestore di baris paling atas (import type dari `./schemas` tidak berubah):

```ts
import { doc, getDoc, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
```

4b. Di `generateInviteCode`, ganti cabang tanpa seed (`if (!seed) { ... }`) agar memakai Web Crypto, bukan `Math.random`:

```ts
  if (!seed) {
    // 32 karakter membagi 2^32 tanpa sisa, jadi modulo tidak menimbulkan bias
    const values = crypto.getRandomValues(new Uint32Array(length));
    let result = '';
    for (const value of values) {
      result += INVITE_CHARS[value % charsLen];
    }
    return result;
  }
```

4c. Ubah signature `createInitialLedger` dan baris `inviteCode`:

```ts
export function createInitialLedger(
  owner: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
  name?: string,
  inviteCode: string = generateInviteCode(6)
): Ledger {
```

Hapus baris `const inviteCode = generateInviteCode(6, owner.uid);` di dalam fungsi.

4d. Di `reconcileOrPreserveLedger`, ganti `inviteCode: existing.inviteCode || generateInviteCode(6, owner.uid),` dengan `inviteCode: existing.inviteCode || generateInviteCode(6),`.

4e. Hapus fungsi `getLedgerByInviteCode`. Fungsi `addMemberToLedger` dan `findDuplicateReceipt` tetap ada untuk sekarang.

4f. Ganti `getLedgerById` dan `joinLedgerByCode`, lalu tambahkan tiga fungsi baru:

```ts
const MAX_INVITE_CODE_ATTEMPTS = 5;

/**
 * Fetches a ledger by its document ID. Throws permission-denied for non-members.
 */
export async function getLedgerById(ledgerId: string): Promise<Ledger | null> {
  const snap = await getDoc(doc(db, 'ledgers', ledgerId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Ledger), id: snap.id };
}

/**
 * Generates a random invite code that is not yet registered in invites/{code}.
 */
export async function generateUnusedInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    const code = generateInviteCode(6);
    const snap = await getDoc(doc(db, 'invites', code));
    if (!snap.exists()) return code;
  }
  throw new Error('Gagal membuat kode undangan unik. Silakan coba lagi.');
}

/**
 * Registers invites/{inviteCode} -> ledgerId when it is missing.
 * Only the ledger owner passes the rules; ledgers created before invites/ existed heal here.
 */
export async function ensureInviteIndex(ledgerId: string, inviteCode: string): Promise<void> {
  const ref = doc(db, 'invites', inviteCode);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, { ledgerId, createdAt: Date.now() });
}

/**
 * Replaces the ledger invite code. The old code stops working immediately.
 */
export async function rotateInviteCode(ledger: Ledger): Promise<string> {
  const newCode = await generateUnusedInviteCode();
  const oldInviteRef = doc(db, 'invites', ledger.inviteCode);
  const oldInvite = await getDoc(oldInviteRef);
  const now = Date.now();

  const batch = writeBatch(db);
  batch.update(doc(db, 'ledgers', ledger.id), { inviteCode: newCode, updatedAt: now });
  batch.set(doc(db, 'invites', newCode), { ledgerId: ledger.id, createdAt: now });
  // Rules delete membaca resource.data.ledgerId, jadi hanya hapus indeks lama yang memang ada
  if (oldInvite.exists() && oldInvite.data().ledgerId === ledger.id) {
    batch.delete(oldInviteRef);
  }
  await batch.commit();
  return newCode;
}

/**
 * Joins the current user into a ledger using an invite code.
 * Non-members cannot read the ledger, so the member entry is written with a field-path update
 * and the rules verify joinCode against the ledger's current inviteCode.
 */
export async function joinLedgerByCode(
  code: string,
  user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null }
): Promise<Ledger> {
  const cleanCode = code.trim().toUpperCase();
  const inviteSnap = await getDoc(doc(db, 'invites', cleanCode));
  if (!inviteSnap.exists()) {
    throw new Error('Kode undangan tidak ditemukan atau sudah diganti.');
  }
  const { ledgerId } = inviteSnap.data() as { ledgerId: string };

  // Owner dan anggota lama bisa membaca ledger; jangan timpa entry mereka (role owner bisa hilang)
  const existing = await getLedgerById(ledgerId).catch(() => null);
  if (!existing?.members?.[user.uid]) {
    const member: Record<string, unknown> = {
      uid: user.uid,
      name: user.displayName?.trim() || user.email?.split('@')[0] || 'Anggota',
      email: user.email || '',
      role: 'member',
      joinedAt: Date.now(),
      joinCode: cleanCode,
    };
    // Firestore menolak nilai undefined
    if (user.photoURL) member.photoURL = user.photoURL;

    try {
      await updateDoc(doc(db, 'ledgers', ledgerId), {
        [`members.${user.uid}`]: member,
        updatedAt: Date.now(),
      });
    } catch {
      throw new Error('Gagal bergabung. Kode undangan mungkin sudah diganti oleh pemilik buku kas.');
    }
  }

  await setDoc(doc(db, 'users', user.uid), { activeLedgerId: ledgerId, familyLedgerId: ledgerId }, { merge: true });

  const ledger = await getLedgerById(ledgerId);
  if (!ledger) {
    throw new Error('Buku kas tidak ditemukan.');
  }
  return ledger;
}
```

4g. Ganti isi `createAndSaveLedger` agar ledger baru dan indeksnya ditulis dalam satu batch:

```ts
export async function createAndSaveLedger(
  owner: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
  name?: string
): Promise<Ledger> {
  const ledgerRef = doc(db, 'ledgers', owner.uid);
  const snap = await getDoc(ledgerRef);

  let targetLedger: Ledger;
  if (snap.exists()) {
    targetLedger = reconcileOrPreserveLedger(snap.data() as Ledger, owner, name);
    await setDoc(ledgerRef, targetLedger, { merge: true });
    await ensureInviteIndex(targetLedger.id, targetLedger.inviteCode);
  } else {
    const inviteCode = await generateUnusedInviteCode();
    targetLedger = createInitialLedger(owner, name, inviteCode);
    const batch = writeBatch(db);
    batch.set(ledgerRef, targetLedger);
    batch.set(doc(db, 'invites', inviteCode), { ledgerId: targetLedger.id, createdAt: Date.now() });
    await batch.commit();
  }

  await ensureLedgerDefaults(targetLedger.id);
  await setDoc(
    doc(db, 'users', owner.uid),
    { activeLedgerId: targetLedger.id, familyLedgerId: targetLedger.id },
    { merge: true }
  );
  return targetLedger;
}
```

> Catatan: `createInitialLedger` mengisi `photoURL: owner.photoURL || undefined`. Pengguna Google selalu punya foto, jadi kode lama tidak pernah menulis `undefined`. Perilaku ini tidak diubah di Fase 0.

- [ ] **Step 5: Jalankan unit test dan type check**

Run: `bun test src/lib/ledgerService.test.ts src/features/family/family.test.ts && npx tsc -b --pretty false`
Expected: test PASS dan `tsc` 0 error.

- [ ] **Step 6: Sesuaikan Gate 14 di `tests/e2e-gates.test.ts`**

Ganti langkah `// 5. Query ledger by invite code (allowed for invite link preview)` beserta empat baris di bawahnya dengan:

```ts
    // 5. Kode undangan di-resolve lewat invites/{code}; ledger tidak bisa di-query oleh non-anggota
    await setDoc(doc(db, 'invites', 'KATAT8'), { ledgerId, createdAt: Date.now() });
    const inviteSnap = await getDoc(doc(db, 'invites', 'KATAT8'));
    expect(inviteSnap.exists()).toBe(true);
    expect(inviteSnap.data()?.ledgerId).toBe(ledgerId);
```

Jika `query` dan `where` tidak lagi dipakai di file itu, hapus dari import.

- [ ] **Step 7: Jalankan e2e gates**

Run: `bun run test:e2e`
Expected: PASS untuk semua gate.

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas.ts src/lib/ledgerService.ts src/lib/ledgerService.test.ts src/features/family/family.test.ts tests/e2e-gates.test.ts
git commit -m "feat(family): resolve invite codes via invites index and use random codes"
```

---

### Task 5: Tombol "Buat kode baru" untuk owner

**Konteks:** Ledger lama memakai kode yang diturunkan dari UID owner (`generateInviteCode(6, owner.uid)`), dan algoritmanya ada di repo. Owner perlu cara untuk mengganti kode itu. Kode lama otomatis berhenti bekerja karena rules mencocokkan `joinCode` dengan `inviteCode` saat ini.

**Files:**
- Modify: `src/features/family/FamilyLedgerSheet.tsx`

- [ ] **Step 1: Tambahkan prop dan state**

Tambahkan ke `FamilyLedgerSheetProps`:

```ts
  onRotateInviteCode?: () => Promise<void>;
```

Tambahkan `onRotateInviteCode,` ke destructuring props, lalu di bawah `const [copied, setCopied] = useState(false);`:

```ts
  const [isConfirmingRotate, setIsConfirmingRotate] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
```

Tambahkan handler di bawah `handleShareWhatsApp`:

```ts
  const handleRotate = async () => {
    if (!onRotateInviteCode) return;
    try {
      setIsRotating(true);
      setRotateError(null);
      await onRotateInviteCode();
      setIsConfirmingRotate(false);
    } catch (err: unknown) {
      setRotateError(err instanceof Error ? err.message : 'Gagal mengganti kode undangan.');
    } finally {
      setIsRotating(false);
    }
  };
```

- [ ] **Step 2: Render kontrol di dalam `family-invite-card`, tepat setelah tombol WhatsApp**

```tsx
                {onRotateInviteCode && displayLedger.ownerUid === currentUserId && (
                  <div className="mt-3 text-xs">
                    {isConfirmingRotate ? (
                      <div className="flex flex-col gap-2" role="group" aria-label="Konfirmasi ganti kode">
                        <span>Kode lama langsung tidak bisa dipakai. Undangan yang sudah dikirim perlu dibagikan ulang.</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-family-tertiary"
                            onClick={() => setIsConfirmingRotate(false)}
                            disabled={isRotating}
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            className="btn-family-secondary"
                            onClick={handleRotate}
                            disabled={isRotating}
                          >
                            {isRotating ? 'Mengganti...' : 'Ganti kode'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-family-tertiary"
                        onClick={() => setIsConfirmingRotate(true)}
                      >
                        🔁 Buat kode undangan baru
                      </button>
                    )}
                    {rotateError && (
                      <p role="alert" className="mt-2 text-rose-600 dark:text-rose-400">
                        {rotateError}
                      </p>
                    )}
                  </div>
                )}
```

Konfirmasi dibuat inline, bukan `window.confirm()`, sesuai temuan U2 di review.

- [ ] **Step 3: Commit (setelah Task 6 menyambungkan prop)**

Gabungkan commit dengan Task 6.

---

### Task 6: Sambungkan rotasi kode dan self-heal indeks di `DashboardView`

**Files:**
- Modify: `src/features/dashboard/DashboardView.tsx`

- [ ] **Step 1: Tambahkan import**

Tambahkan `ensureInviteIndex` dan `rotateInviteCode` ke import dari `'../../lib/ledgerService'`.

- [ ] **Step 2: Tambahkan self-heal indeks undangan**

Tambahkan setelah effect `// Subscribe to real-time updates for active ledger`:

```ts
  // Ledger yang dibuat sebelum koleksi invites/ ada belum punya indeks kode.
  // Owner membuatnya saat membuka aplikasi; rules hanya mengizinkan owner.
  const ownedLedgerId = savedFamilyLedger?.ownerUid === user.uid ? savedFamilyLedger.id : null;
  const ownedInviteCode = ownedLedgerId ? savedFamilyLedger?.inviteCode ?? null : null;
  useEffect(() => {
    if (!ownedLedgerId || !ownedInviteCode || isShowcaseMode()) return;
    ensureInviteIndex(ownedLedgerId, ownedInviteCode).catch(console.error);
  }, [ownedLedgerId, ownedInviteCode]);
```

- [ ] **Step 3: Tambahkan handler rotasi**

Tambahkan setelah `handleJoinSuccess`:

```ts
  const handleRotateInviteCode = async () => {
    const ledger = savedFamilyLedger;
    if (!ledger || ledger.ownerUid !== user.uid) return;
    const newCode = await rotateInviteCode(ledger);
    // Jika ledger sedang aktif, subscribeToLedger juga akan mengirim kode baru
    setSavedFamilyLedger({ ...ledger, inviteCode: newCode });
  };
```

- [ ] **Step 4: Kirim prop ke `FamilyLedgerSheet`**

Tambahkan `onRotateInviteCode={handleRotateInviteCode}` pada elemen `<FamilyLedgerSheet ... />`.

- [ ] **Step 5: Uji manual dengan emulator**

Run: `bun run emulators` di satu terminal, `bun run dev` di terminal lain.

1. Login sebagai user A, buka "Buku Kas Keluarga", buat buku kas. Catat kodenya.
2. Buka Emulator UI (`http://127.0.0.1:4000/firestore`), pastikan `invites/<kode>` ada dengan `ledgerId` = UID A.
3. Di jendela incognito, login sebagai user B, gabung dengan kode tersebut. Expected: berhasil, B melihat buku kas A.
4. Sebagai A, tekan "Buat kode undangan baru" → "Ganti kode". Expected: kode berubah, `invites/<kode lama>` hilang, `invites/<kode baru>` ada.
5. Sebagai user C, coba gabung dengan kode lama. Expected: pesan "Kode undangan tidak ditemukan atau sudah diganti."
6. Hapus `invites/<kode baru>` lewat Emulator UI, refresh aplikasi sebagai A. Expected: dokumen itu dibuat ulang (self-heal).

- [ ] **Step 6: Commit**

```bash
git add src/features/family/FamilyLedgerSheet.tsx src/features/dashboard/DashboardView.tsx
git commit -m "feat(family): let owners rotate invite codes and self-heal the invite index"
```

---

### Task 7: Test filter tidak boleh bergantung pada tanggal hari ini (T1)

**Files:**
- Modify: `src/lib/transactionFilter.ts`
- Modify: `src/lib/transactionFilter.test.ts`

- [ ] **Step 1: Pastikan test masih gagal**

Run: `bun test src/lib/transactionFilter.test.ts`
Expected: FAIL dengan `Multi-filter AND logic must narrow to exact single match` (data test berada di Oktober 2026, preset `this_month` membaca tanggal hari ini).

- [ ] **Step 2: Tambahkan parameter `now` di `filterTransactions`**

```ts
export function filterTransactions(
  transactions: Transaction[],
  criteria: FilterCriteria,
  accountMap: Map<string, { name: string; isArchived?: boolean }>,
  categoryMap: Map<string, { name: string; icon?: string; isArchived?: boolean }>,
  now: Date = new Date()
): Transaction[] {
  const activeRange =
    criteria.datePreset === 'all'
      ? null
      : criteria.datePreset === 'custom'
      ? criteria.customRange
      : getPresetRange(criteria.datePreset as PresetRange, now);
```

Sisa fungsi tidak berubah.

- [ ] **Step 3: Pakai tanggal tetap di Scenario 3**

Di `src/lib/transactionFilter.test.ts`, Scenario 3, ganti:

```ts
  const results = filterTransactions(sampleTransactions, criteria, mockAccounts, mockCategories);
  assert(results.length === 1 && results[0]?.id === 'tx_1', 'Multi-filter AND logic must narrow to exact single match');
```

dengan:

```ts
  const results = filterTransactions(sampleTransactions, criteria, mockAccounts, mockCategories, new Date(now));
  assert(results.length === 1 && results[0]?.id === 'tx_1', 'Multi-filter AND logic must narrow to exact single match');
```

dan pada pemanggilan `mismatchType` tambahkan argumen kelima `new Date(now)` setelah `mockCategories`.

- [ ] **Step 4: Jalankan seluruh unit test**

Run: `bun test src/`
Expected: `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transactionFilter.ts src/lib/transactionFilter.test.ts
git commit -m "test(filter): inject reference date so preset filters are deterministic"
```

---

### Task 8: Query transaksi per bulan tanpa batas 50 item (D1)

**Files:**
- Create: `src/lib/transactionRange.ts`
- Create: `src/lib/transactionRange.test.ts`
- Create: `src/features/transactions/transactionQueries.ts`
- Rewrite: `src/features/transactions/useTransactions.ts`
- Modify: `src/features/dashboard/DashboardView.tsx`

**Interfaces:**
- Produces: `TransactionRange { start: number; end: number }`, `filterTransactionsInRange(items, range)`, `transactionsCollection(uid, ledgerId?)`, `transactionsInRangeQuery(uid, range, ledgerId?)`, `parseTransactionDocs(docs)`, `findTransactionByReferenceKey(uid, referenceKey, ledgerId?)`
- Changes: `useTransactions(uid: string, range: TransactionRange, ledgerId?: string)` (sebelumnya `(uid, maxItems = 50, ledgerId?)`)

- [ ] **Step 1: Tulis test untuk helper rentang**

Buat `src/lib/transactionRange.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { filterTransactionsInRange } from './transactionRange';

describe('filterTransactionsInRange', () => {
  const range = { start: 1_000, end: 2_000 };

  test('memasukkan batas awal dan mengecualikan batas akhir', () => {
    const items = [{ date: 999 }, { date: 1_000 }, { date: 1_999 }, { date: 2_000 }];
    expect(filterTransactionsInRange(items, range).map((t) => t.date)).toEqual([1_999, 1_000]);
  });

  test('mengurutkan dari yang terbaru', () => {
    const items = [{ date: 1_100 }, { date: 1_900 }, { date: 1_500 }];
    expect(filterTransactionsInRange(items, range).map((t) => t.date)).toEqual([1_900, 1_500, 1_100]);
  });

  test('tidak mengubah array asli', () => {
    const items = [{ date: 1_100 }, { date: 1_900 }];
    filterTransactionsInRange(items, range);
    expect(items.map((t) => t.date)).toEqual([1_100, 1_900]);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `bun test src/lib/transactionRange.test.ts`
Expected: FAIL (`Cannot find module './transactionRange'`).

- [ ] **Step 3: Buat `src/lib/transactionRange.ts`**

```ts
/** Rentang setengah terbuka: start inklusif, end eksklusif (epoch ms). */
export interface TransactionRange {
  start: number;
  end: number;
}

export function filterTransactionsInRange<T extends { date: number }>(
  items: readonly T[],
  range: TransactionRange
): T[] {
  return items
    .filter((item) => item.date >= range.start && item.date < range.end)
    .sort((a, b) => b.date - a.date);
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `bun test src/lib/transactionRange.test.ts`
Expected: PASS.

- [ ] **Step 5: Buat `src/features/transactions/transactionQueries.ts`**

```ts
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { transactionSchema, type Transaction } from '../../lib/schemas';
import { isShowcaseMode } from '../../lib/showcaseMockData';
import type { TransactionRange } from '../../lib/transactionRange';

export function transactionsCollection(uid: string, ledgerId?: string) {
  return ledgerId
    ? collection(db, 'ledgers', ledgerId, 'transactions')
    : collection(db, 'users', uid, 'transactions');
}

/**
 * Semua transaksi dengan date di [range.start, range.end), terbaru dulu.
 * Range dan orderBy pada field yang sama memakai single-field index otomatis.
 */
export function transactionsInRangeQuery(uid: string, range: TransactionRange, ledgerId?: string) {
  return query(
    transactionsCollection(uid, ledgerId),
    where('date', '>=', range.start),
    where('date', '<', range.end),
    orderBy('date', 'desc')
  );
}

export function parseTransactionDocs(docs: QueryDocumentSnapshot[]): Transaction[] {
  const list: Transaction[] = [];
  for (const snapshot of docs) {
    const parsed = transactionSchema.safeParse(snapshot.data());
    if (parsed.success) list.push(parsed.data);
  }
  return list;
}

/**
 * Mencari struk yang sudah pernah dicatat di seluruh riwayat, bukan hanya bulan yang sedang dimuat.
 */
export async function findTransactionByReferenceKey(
  uid: string,
  referenceKey: string | null | undefined,
  ledgerId?: string
): Promise<Transaction | null> {
  const key = referenceKey?.trim();
  if (!key || isShowcaseMode()) return null;
  const snap = await getDocs(
    query(transactionsCollection(uid, ledgerId), where('referenceKey', '==', key), limit(1))
  );
  return parseTransactionDocs(snap.docs)[0] ?? null;
}
```

- [ ] **Step 6: Tulis ulang `src/features/transactions/useTransactions.ts`**

```ts
import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import type { Transaction } from '../../lib/schemas';
import { isShowcaseMode, MOCK_SHOWCASE_TRANSACTIONS } from '../../lib/showcaseMockData';
import { filterTransactionsInRange, type TransactionRange } from '../../lib/transactionRange';
import { parseTransactionDocs, transactionsInRangeQuery } from './transactionQueries';

interface SnapshotState {
  key: string;
  transactions: Transaction[];
  error: string | null;
}

const EMPTY_STATE: SnapshotState = { key: '', transactions: [], error: null };

/**
 * Subscribes to every transaction in [range.start, range.end).
 * Tidak ada batas jumlah: total bulanan, anggaran, statistik, dan export harus melihat seluruh rentang.
 * Listener dengan query yang sama dibagi oleh Firestore SDK, jadi pemakaian ganda tidak menambah biaya baca.
 */
export function useTransactions(uid: string, range: TransactionRange, ledgerId?: string) {
  const { start, end } = range;
  const showcase = isShowcaseMode();
  const key = `${ledgerId ?? `user:${uid}`}|${start}|${end}`;
  const [state, setState] = useState<SnapshotState>(EMPTY_STATE);

  useEffect(() => {
    if (showcase || (!uid && !ledgerId)) return;
    return onSnapshot(
      transactionsInRangeQuery(uid, { start, end }, ledgerId),
      (snap) => setState({ key, transactions: parseTransactionDocs(snap.docs), error: null }),
      (err) => setState({ key, transactions: [], error: err.message })
    );
  }, [showcase, uid, ledgerId, start, end, key]);

  const showcaseTransactions = useMemo(
    () => (showcase ? filterTransactionsInRange(MOCK_SHOWCASE_TRANSACTIONS, { start, end }) : EMPTY_STATE.transactions),
    [showcase, start, end]
  );

  if (showcase) {
    return { transactions: showcaseTransactions, loading: false, error: null };
  }

  // Data bulan sebelumnya tidak ditampilkan saat bulan berganti; loading sampai snapshot bulan baru tiba
  const isCurrent = state.key === key;
  return {
    transactions: isCurrent ? state.transactions : EMPTY_STATE.transactions,
    loading: !isCurrent,
    error: isCurrent ? state.error : null,
  };
}
```

- [ ] **Step 7: Pindahkan state bulan ke atas di `DashboardView.tsx` dan pakai hook baru**

Potong blok berikut dari posisinya sekarang (di bawah `handlePayDebt`):

```ts
  // Month summary & navigation state
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => { ... });
  const { startOfMonth, endOfMonth } = useMemo(...);
  const monthLabel = useMemo(...);
  const handlePrevMonth = () => { ... };
  const handleNextMonth = () => { ... };
```

dan tempelkan tepat di atas `// Firestore Data Hooks`, lalu tambahkan `monthRange` di bawahnya:

```ts
  // Month summary & navigation state (dipakai oleh query transaksi, jadi harus di atas hook data)
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { startOfMonth, endOfMonth } = useMemo(
    () => getMonthRange(selectedMonth),
    [selectedMonth]
  );
  const monthRange = useMemo(() => ({ start: startOfMonth, end: endOfMonth }), [startOfMonth, endOfMonth]);

  const monthLabel = useMemo(() => formatMonthYear(selectedMonth), [selectedMonth]);

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, 1));
  };
```

Lalu ganti:

```ts
  const { transactions, loading: txLoading } = useTransactions(user.uid, 50, activeLedgerId || undefined);
```

dengan:

```ts
  const { transactions, loading: txLoading } = useTransactions(user.uid, monthRange, activeLedgerId || undefined);
```

Perhitungan `monthIncome`/`monthExpense` tidak perlu diubah. Filter tanggal di dalamnya sekarang selalu benar, tapi tetap aman dibiarkan.

- [ ] **Step 8: Verifikasi**

Run: `npx tsc -b --pretty false && bun test src/`
Expected: `tsc` 0 error dan unit test `0 fail`. `DashboardView` adalah satu-satunya pemanggil `useTransactions` di titik ini.

- [ ] **Step 9: Commit**

```bash
git add src/lib/transactionRange.ts src/lib/transactionRange.test.ts \
  src/features/transactions/transactionQueries.ts src/features/transactions/useTransactions.ts \
  src/features/dashboard/DashboardView.tsx
git commit -m "fix(data): load every transaction of the selected month instead of the latest 50"
```

---

### Task 9: Semua tab memakai bulan yang sama (D3) dan konsumen data disesuaikan

**Files:**
- Modify: `src/features/budgets/BudgetsTab.tsx`
- Modify: `src/features/analytics/StatsTab.tsx`
- Modify: `src/components/modals/SearchModal.tsx`
- Modify: `src/features/dashboard/HomeTab.tsx`
- Modify: `src/features/transactions/TransactionFormSheet.tsx`
- Modify: `src/features/dashboard/DashboardView.tsx`

- [ ] **Step 1: `BudgetsTab` memakai bulan yang dipilih**

Tambahkan import:

```ts
import { formatMonthYear, getMonthRange } from '../../lib/monthNavigator';
```

Tambahkan `selectedMonth: Date;` ke `BudgetsTabProps` dan `selectedMonth,` ke destructuring. Ganti:

```ts
  // Filter current month transactions
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
```

dengan:

```ts
  const { startOfMonth, endOfMonth } = getMonthRange(selectedMonth);
  const monthLabel = formatMonthYear(selectedMonth);
```

Ganti teks `Total Anggaran Bulan Ini` dengan `{`Anggaran ${monthLabel}`}`.

- [ ] **Step 2: Nama file CSV mengikuti bulan yang diekspor**

Di `StatsTab.tsx`, ganti isi `handleExportCsv`:

```ts
  const handleExportCsv = () => {
    playHapticSound('success');
    // `transactions` sudah berisi seluruh transaksi bulan terpilih (Task 8)
    const content = generateCsvContent(transactions, accountMap, categoryMap);
    const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    downloadCsv(`catat_laporan_keuangan_${monthKey}.csv`, content);
  };
```

- [ ] **Step 3: Search menampilkan cakupannya**

Di `SearchModal.tsx`, tambahkan `scopeLabel?: string;` ke `SearchModalProps` dan `scopeLabel,` ke destructuring. Ganti `placeholder="Cari transaksi, nominal, akun, kategori..."` dengan:

```tsx
              placeholder={scopeLabel ? `Cari transaksi ${scopeLabel}...` : 'Cari transaksi, nominal, akun, kategori...'}
```

- [ ] **Step 4: Empty state Beranda menyebut bulannya**

Di `HomeTab.tsx`, ganti:

```tsx
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Belum Ada Transaksi</h3>
```

dengan:

```tsx
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              Belum ada transaksi di {selectedMonthLabel}
            </h3>
```

- [ ] **Step 5: Form menghitung peringatan anggaran dari bulan tanggal transaksi**

Di `TransactionFormSheet.tsx`:

5a. Ganti import `import { findDuplicateReceipt } from '../../lib/ledgerService';` dengan:

```ts
import { getMonthRange } from '../../lib/monthNavigator';
import { useTransactions } from './useTransactions';
import { findTransactionByReferenceKey } from './transactionQueries';
```

5b. Hapus `existingTransactions?: Transaction[];` dari interface props dan `existingTransactions = [],` dari destructuring.

5c. Tepat di atas `const budgetWarning = useMemo(() => {`, tambahkan:

```ts
  // Bulan dari tanggal transaksi, bukan bulan yang sedang dibuka di dashboard.
  // Jika sama, Firestore SDK memakai ulang listener dashboard.
  const budgetMonth = useMemo(() => {
    const { startOfMonth, endOfMonth } = getMonthRange(new Date(dateStr || Date.now()));
    return { start: startOfMonth, end: endOfMonth };
  }, [dateStr]);
  const { transactions: budgetMonthTransactions } = useTransactions(uid, budgetMonth, ledgerId);
```

5d. Di dalam `budgetWarning`, ganti:

```ts
    let currentSpent = 0;
    if (existingTransactions) {
      for (const tx of existingTransactions) {
        if (
          tx.type === 'expense' &&
          tx.categoryId === currentCategoryId &&
          tx.date >= startOfMonth &&
          tx.date < endOfMonth &&
          tx.id !== initialTx?.id
        ) {
          currentSpent += tx.amount;
        }
      }
    }
```

dengan:

```ts
    let currentSpent = 0;
    for (const tx of budgetMonthTransactions) {
      if (
        tx.type === 'expense' &&
        tx.categoryId === currentCategoryId &&
        tx.date >= startOfMonth &&
        tx.date < endOfMonth &&
        tx.id !== initialTx?.id
      ) {
        currentSpent += tx.amount;
      }
    }
```

lalu di dependency array ganti `existingTransactions` dengan `budgetMonthTransactions`.

5e. Di `handleOcrSuccess`, ganti:

```ts
    const dup = findDuplicateReceipt(existingTransactions, res.referenceKey);
    setDuplicateMatch(dup);
```

dengan:

```ts
    // Cek duplikat di seluruh riwayat; hasilnya hanya peringatan, jadi tidak memblokir review
    setDuplicateMatch(null);
    findTransactionByReferenceKey(uid, res.referenceKey, ledgerId)
      .then(setDuplicateMatch)
      .catch(() => setDuplicateMatch(null));
```

> Pencocokan `referenceKey` sekarang case-sensitive (sebelumnya `toLowerCase()` di client). Nilainya berasal dari OCR struk yang sama, jadi formatnya konsisten. Jika ada laporan duplikat yang lolos, normalisasi `referenceKey` ke lowercase saat menulis transaksi.

5f. Hapus `findDuplicateReceipt` yang sekarang tidak terpakai:
- Di `src/lib/ledgerService.ts`, hapus fungsi `findDuplicateReceipt` dan ubah import type menjadi `import type { Ledger, LedgerMember } from './schemas';`.
- Di `src/lib/ledgerService.test.ts`, hapus `findDuplicateReceipt,` dari import, ubah import type menjadi `import type { LedgerMember } from './schemas';`, dan hapus seluruh bagian `// 4. findDuplicateReceipt` (dari `const existingTx = {` sampai tiga baris `assert(findDuplicateReceipt(...))`).

- [ ] **Step 6: Sesuaikan props di `DashboardView.tsx`**

- Pada `<BudgetsTab ... />` tambahkan `selectedMonth={selectedMonth}`.
- Pada `<SearchModal ... />` tambahkan `scopeLabel={monthLabel}`.
- Pada `<TransactionFormSheet ... />` hapus `existingTransactions={transactions}`.

- [ ] **Step 7: Verifikasi**

Run: `npx tsc -b --pretty false && bun run lint && bun test src/`
Expected: `tsc` 0 error, lint 0 error (jumlah warning boleh turun, tidak boleh naik dari 32), unit test `0 fail`.

- [ ] **Step 8: Uji manual (emulator)**

1. Dengan emulator dan `bun run dev`, buat lebih dari 50 transaksi di bulan berjalan (misalnya lewat tab Ketik, atau Gate 15 di Task 10 sebagai acuan data).
2. Expected: hero card, Anggaran, dan Statistik menghitung semua transaksi, dan jumlah di "N Transaksi Tercatat" lebih dari 50.
3. Pindah ke bulan sebelumnya di hero card. Expected: daftar Beranda, Anggaran, dan Statistik ikut berganti ke bulan itu. Search menampilkan placeholder "Cari transaksi <bulan>...".
4. Export CSV di Statistik. Expected: nama file `catat_laporan_keuangan_YYYY-MM.csv` dan isinya semua transaksi bulan itu.
5. Tambah transaksi pengeluaran bertanggal bulan lain pada kategori yang punya anggaran. Expected: peringatan anggaran dihitung dari bulan tanggal transaksi.
6. Buka `/?demo` (showcase). Expected: data mock tetap tampil untuk bulan berjalan.

- [ ] **Step 9: Commit**

```bash
git add src/features/transactions/TransactionFormSheet.tsx src/features/dashboard/DashboardView.tsx \
  src/features/dashboard/HomeTab.tsx src/features/budgets/BudgetsTab.tsx \
  src/features/analytics/StatsTab.tsx src/components/modals/SearchModal.tsx \
  src/lib/ledgerService.ts src/lib/ledgerService.test.ts
git commit -m "fix(data): share the selected month across tabs and check duplicate receipts across history"
```

---

### Task 10: Gate e2e untuk query bulanan

**Files:**
- Modify: `tests/e2e-gates.test.ts`

- [ ] **Step 1: Tambahkan Gate 15 di dalam `describe('E2E P0 Gates ...')`**

Bulan Februari 2030 dipakai agar tidak bercampur dengan transaksi `Date.now()` dari gate lain.

```ts
  it('Gate 15: Month-scoped query returns every transaction in the month (no 50-item cap)', async () => {
    const { transactionsInRangeQuery, parseTransactionDocs, findTransactionByReferenceKey } = await import(
      '../src/features/transactions/transactionQueries'
    );
    const { getMonthRange } = await import('../src/lib/monthNavigator');

    const { startOfMonth, endOfMonth } = getMonthRange(new Date(2030, 1, 1));
    const col = collection(db, 'users', testUid, 'transactions');
    const now = Date.now();
    const writes: Promise<void>[] = [];

    for (let i = 0; i < 60; i++) {
      const id = `tx_feb2030_${i}`;
      writes.push(
        setDoc(doc(col, id), {
          id,
          type: 'expense',
          amount: 1_000 + i,
          accountId: 'acc_gate15',
          categoryId: 'cat_gate15',
          date: startOfMonth + i * 60_000,
          note: '',
          referenceKey: i === 0 ? 'shopee#GATE15-REF' : null,
          createdAt: now,
          updatedAt: now,
        })
      );
    }
    for (let i = 0; i < 5; i++) {
      const id = `tx_jan2030_${i}`;
      writes.push(
        setDoc(doc(col, id), {
          id,
          type: 'expense',
          amount: 500,
          accountId: 'acc_gate15',
          categoryId: 'cat_gate15',
          date: startOfMonth - (i + 1) * 60_000,
          note: '',
          createdAt: now,
          updatedAt: now,
        })
      );
    }
    await Promise.all(writes);

    const snap = await getDocs(transactionsInRangeQuery(testUid, { start: startOfMonth, end: endOfMonth }));
    const result = parseTransactionDocs(snap.docs);
    expect(result.length).toBe(60);
    expect(result.every((t) => t.date >= startOfMonth && t.date < endOfMonth)).toBe(true);
    expect(result[0]!.date).toBeGreaterThan(result[59]!.date);

    expect((await findTransactionByReferenceKey(testUid, 'shopee#GATE15-REF'))?.id).toBe('tx_feb2030_0');
    expect(await findTransactionByReferenceKey(testUid, 'shopee#TIDAK-ADA')).toBeNull();
  });
```

- [ ] **Step 2: Jalankan e2e gates**

Run: `bun run test:e2e`
Expected: PASS, termasuk Gate 15.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e-gates.test.ts
git commit -m "test(e2e): gate month-scoped transaction query and reference key lookup"
```

---

### Task 11: Verifikasi akhir dan runbook deploy (manual, oleh pemilik project)

Langkah ini mengubah sistem produksi dan konfigurasi Firebase Console. **Jangan dijalankan oleh agent.**

- [ ] **Step 1: Verifikasi lengkap**

```bash
npx tsc -b --pretty false
bun run lint
bun test src/
bun run test:rules
bun run test:e2e
bun run build
grep -cE 'FIREBASE_APPCHECK_DEBUG_TOKEN=.?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-' dist/assets/*.js
```

Expected: semua lulus, dan perintah `grep -c` terakhir mencetak `0` untuk setiap file.

- [ ] **Step 2: Deploy rules dan hosting bersamaan**

```bash
firebase deploy --only firestore:rules,hosting
```

Service worker memakai network-first untuk navigasi, jadi pengguna yang online mendapat bundle baru pada pembukaan berikutnya. Pengguna yang sedang membuka aplikasi lama perlu me-refresh; sampai saat itu, fitur gabung buku kas di tab mereka gagal karena memakai query lama.

- [ ] **Step 3: Pastikan produksi tidak lagi memakai debug token**

Buka situs produksi di jendela baru, lalu di DevTools Console jalankan `self.FIREBASE_APPCHECK_DEBUG_TOKEN`.
Expected: `undefined`.

- [ ] **Step 4: Cabut debug token lama**

Firebase Console → App Check → Apps → web app → menu ⋮ → **Manage debug tokens** → hapus token yang berawalan `51561ED6`. Buat token baru untuk development, lalu isi `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` di `.env` lokal dengan token baru.

Token lama masih ada di riwayat git. Setelah dicabut, token itu tidak berguna, jadi riwayat git tidak perlu ditulis ulang.

- [ ] **Step 5: Periksa enforcement App Check**

Firebase Console → App Check → APIs. Lihat metrik permintaan terverifikasi untuk **Cloud Firestore** dan **Firebase AI Logic**. Jika hampir semua permintaan sudah terverifikasi setelah deploy, aktifkan **Enforce**. Jika belum, tunggu dan pantau dulu; enforcement terlalu dini memblokir pengguna yang sah.

- [ ] **Step 6: Batasi pemanggilan Gemini per pengguna**

Firebase Console → AI Logic → Settings. Atur rate limit per pengguna ke angka yang sesuai dengan pemakaian normal (misalnya beberapa permintaan per menit). Ini pembatas untuk pemanggilan SDK langsung yang tidak melewati kuota `scanUsage`.

- [ ] **Step 7: Smoke test produksi**

1. Login, pastikan Beranda, Anggaran, dan Statistik tampil untuk bulan berjalan.
2. Owner buku kas keluarga membuka aplikasi sekali. Cek di Firestore Console bahwa `invites/<kode>` terbentuk.
3. Gabung dengan akun kedua memakai kode itu.
4. Scan satu struk dan pastikan `scanUsage/<uid>_<tanggal>` naik satu.

> Owner yang belum membuka aplikasi setelah deploy belum punya `invites/<kode>`. Undangan dari mereka akan gagal dengan pesan "Kode undangan tidak ditemukan atau sudah diganti" sampai owner membuka aplikasi. Jika ini terlalu mengganggu, opsi lanjutan adalah tombol backfill di dashboard admin, yang membutuhkan cabang `isSuperAdmin()` tambahan di rule `invites` create.

---

## Di luar cakupan Fase 0

Masuk plan Fase 1 dan Fase 2 (ditulis setelah Fase 0 di-merge karena keduanya bergantung pada `useTransactions` baru):

- Menghidupkan kembali search dan filter di Beranda, termasuk pencarian seluruh riwayat (D2)
- Menghapus daftar email admin di `useSuperAdmin.ts` dan Gate 13 (S5 bagian client)
- Validasi bentuk data transaksi di rules (C5)
- Proxy Cloud Function untuk kuota Gemini yang dijamin server
- Refresh UI, aksesibilitas, dan pembersihan kode (U1 sampai U6, C1 sampai C4)

---

## Catatan implementasi (9 November 2026)

Task 1 sampai 10 selesai di branch `fix/fase-0-security-data`. Task 11 (deploy dan Firebase Console) belum dijalankan dan tetap menjadi tugas pemilik project.

Perbedaan dari plan:

- **`src/lib/transactionRange.test.ts` memakai `assert()` di top level, bukan `bun:test`.** `tsconfig.app.json` meng-include `src/` dan tidak punya tipe `bun:test`, jadi `tsc -b` gagal. Constraint "test baru memakai `bun:test`" hanya berlaku untuk `tests/` sampai tipe Bun ditambahkan (Fase 2, T1).
- **Gate 16 ditambahkan** di `tests/e2e-gates.test.ts`. Gate ini menguji alur nyata dengan dua user di emulator: buat buku kas, ganti kode, kode lama ditolak, non-anggota tidak bisa membaca ledger, join dengan kode baru, join ulang tidak menimpa entry, dan anggota tidak bisa mengganti kode. Gate ini menggantikan uji manual Task 6 Step 5 untuk bagian service dan rules.
- **Polyfill e2e diperluas** dengan `window.location` dan `globalThis.localStorage`, karena helper query memanggil `isShowcaseMode()`.
- **`budgetMonth` di `TransactionFormSheet`** tidak memakai `Date.now()` sebagai fallback. Tanggal kosong atau tidak valid menghasilkan rentang kosong, sehingga satu warning `react(purity)` hilang.

Hasil verifikasi akhir:

| Pemeriksaan | Sebelum | Sesudah |
|---|---|---|
| `tsc -b` | 0 error | 0 error |
| `bun run lint` | 0 error, 32 warning | 0 error, 30 warning |
| `bun test src/` | 1 file error | 43 file, 0 error |
| `bun run test:rules` | 12 pass | 24 pass |
| `bun run test:e2e` | 15 pass | 17 pass |
| `bun run test:ocr-live` | tidak dijalankan | 6 pass |
| Debug token di `dist/` | ada | tidak ada |
| Smoke test browser (`/?demo`) | tidak ada | Beranda, Anggaran, Statistik, navigasi bulan, dan placeholder Search mengikuti bulan; tanpa error console |

Belum diuji: tampilan tombol "Buat kode undangan baru" di browser. Mode showcase tidak memuat buku kas keluarga, dan login Google di emulator tidak diotomasi.
