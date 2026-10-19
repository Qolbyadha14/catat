# Design Specification: Family Ledger (Buku Kas Bersama), Member Invite & "Created By" Attribution

**Date:** 2026-10-19  
**Status:** Validated & Approved  
**Author:** Pair Programming (Google DeepMind Antigravity + User)

---

## 1. Executive Summary & Goals

Catat is evolving from a single-user personal finance tracker into a **collaborative household finance platform** ("Buku Kas Bersama"). Spouses, partners, and family members need to manage their shared expenses and cashflow in real-time, see who logged each receipt or manual entry, and invite members with zero friction via WhatsApp.

### Key Objectives
1. **Buku Kas Bersama (Shared Family Ledger):** Allow multiple user accounts to share a single ledger containing accounts, categories, and transactions with real-time balance synchronization.
2. **"Created By" Attribution:** Automatically attach creator metadata (`uid`, `name`, `photoURL`) to every transaction created (via OCR scan, text assistant, or manual entry) and display it gracefully in the transaction history.
3. **Frictionless WhatsApp Invite Flow:** Allow owners to generate an invite link (`https://catat-8897d.web.app/join?code=XYZ123`) and a 6-character code that can be shared via WhatsApp. Members join with a single confirmation tap.
4. **Equal Collaboration (Co-Owners):** All members can record, edit, and view transactions and account balances.
5. **Zero Breaking Changes:** Existing single-user accounts automatically map to their default ledger (`ledgerId = uid`), ensuring 100% backward compatibility with existing tests and Firestore data.

---

## 2. Architecture & Data Model

### 2.1 Firestore Structure

```
/ledgers/{ledgerId}
  ├── id: string
  ├── name: string (e.g. "Keluarga Qolby")
  ├── ownerUid: string
  ├── inviteCode: string (6 uppercase alphanumeric characters, indexed)
  ├── members: Map<string, MemberProfile>
  ├── createdAt: number
  └── updatedAt: number

  Subcollections:
  ├── /accounts/{accountId}
  ├── /categories/{categoryId}
  └── /transactions/{transactionId}

/users/{uid}
  ├── uid: string
  ├── email: string
  ├── displayName: string
  ├── photoURL?: string
  ├── activeLedgerId: string
  └── ledgers: string[] (array of ledger IDs user belongs to)
```

### 2.2 Member Profile Schema
```typescript
export interface LedgerMember {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'owner' | 'member';
  joinedAt: number;
}
```

### 2.3 Extended Transaction Schema (`createdBy`)

In `src/lib/schemas.ts`:
```typescript
export const creatorSchema = z.object({
  uid: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  photoURL: z.string().url().optional(),
});

export type TransactionCreator = z.infer<typeof creatorSchema>;

// Extend baseTx with createdBy and referenceKey (e.g. "tiktok#578129381293812")
const baseTx = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  date: z.number().int(),
  note: z.string().trim().max(140).optional().default(''),
  referenceKey: z.string().trim().max(120).nullable().optional(), // e.g. "tiktok#578129381293812"
  createdBy: creatorSchema.optional(), // Optional for backward compatibility
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
```

### 2.4 OCR Schema Extension (`transactionNumber` & `referenceKey`)
In `src/lib/ocr/schema.ts`:
```typescript
export const ocrReceiptSchema = z.object({
  // ... existing fields
  transactionNumber: z.string().trim().max(100).nullable().optional().default(null),
});

export interface OcrReceiptResult {
  // ... existing fields
  transactionNumber: string | null;
  referenceKey: string | null; // Formatted as `${platform}#${transactionNumber}`
}
```

---

## 3. User Flows & Feature Details

### 3.1 Automatic Default Ledger & Migration
1. On login, the app checks if `user.activeLedgerId` exists.
2. If not:
   - A default ledger is resolved or initialized where `ledgerId = user.uid`, with `name = "Buku Kas Pribadi"` (or `"Keluarga [Name]"`), `ownerUid = user.uid`, and user as the sole member.
   - Any existing collections at `/users/{uid}/accounts`, `/users/{uid}/categories`, and `/users/{uid}/transactions` continue to work seamlessly or are mirrored under the ledger service.
   - This ensures zero downtime and 100% pass rate for existing tests.

### 3.2 Member Invitation Flow
1. **Invite Modal ("Buku Kas Keluarga"):**
   - Accessible via the header (Family icon / Settings menu).
   - Shows current ledger name (editable by owner), member list, and active invite code (e.g., `KATAT8`).
   - Button **[📱 Bagikan Undangan WhatsApp]**:
     - Generates pre-formatted text:
       > *"Yuk kelola keuangan keluarga bareng di Catat! Buka link ini untuk bergabung ke Buku Kas Keluarga: https://catat-8897d.web.app/join?code=KATAT8"*
     - Uses Web Share API on mobile (opens WhatsApp directly) or copies to clipboard with toast feedback.
   - Button **[Salin Kode]**: Copies `KATAT8`.
   - Option to regenerate code if needed.

2. **Join Flow (`/join?code=...` or "Gabung dengan Kode"):**
   - If a user opens the app with `?code=KATAT8` (or enters code manually in Join dialog):
   - The app queries Firestore for `ledgers` where `inviteCode == 'KATAT8'`.
   - Displays confirmation card:
     > **Gabung ke Buku Kas Keluarga**  
     > **Nama:** Keluarga Qolby  
     > **Pemilik:** Qolby Adha  
     > *Anda akan dapat mencatat transaksi, scan struk, dan melihat saldo dompet bersama.*
   - Upon clicking **"Gabung Sekarang"**:
     - Adds user's profile to `ledger.members[user.uid]`.
     - Updates user's `activeLedgerId = ledger.id`.
     - Closes modal, refreshes dashboard, and shows welcoming toast: *"Selamat bergabung di Keluarga Qolby!"*.

### 3.3 "Created By" Attribution UI
In the Dashboard transaction history item:
- Beside the transaction date:
  - If `tx.createdBy` is present:
    - Renders small circular initial badge / avatar + name:
      `📅 19 Okt 2026 • 👤 Sarah`
  - If `tx.createdBy` matches current user:
    - Displays `👤 Anda` or user's name for clarity.
  - If `tx.createdBy` is absent (legacy data):
    - Renders `📅 19 Okt 2026` cleanly without placeholder slop.

### 3.4 Transaction Reference Key & Anti-Duplicate Detection
1. **OCR Extraction (`transactionNumber`):**
   - The multimodal Gemini prompt is updated to extract order / transaction / reference IDs:
     - TikTok Shop: nomor pesanan (e.g. `578129381293812`)
     - Shopee / ShopeeFood: nomor pesanan (e.g. `231019ABCD123`)
     - GoFood / GoJek: order id
     - Bank Transfer / QRIS: nomor referensi transaksi
   - Formatted automatically into a canonical `referenceKey`:
     `const referenceKey = result.transactionNumber ? `${result.platform}#${result.transactionNumber}` : null;` (e.g. `tiktok#578129381293812`).

2. **Deduplication Check (Anti-Double Record):**
   - When reviewing scanned receipts (in `OcrReviewCard` or `BatchReviewQueue`):
   - The system checks if any existing transaction in the active ledger already has this `referenceKey`.
   - If found:
     - Displays a clear, helpful warning in the review card:
       ⚠️ **Struk ini sudah pernah dicatat sebelumnya pada [Tanggal] oleh [Nama Anggota]!**
     - User can inspect the duplicate and either cancel or choose to proceed if it is intentionally separate.
   - Prevents spouses or family members from accidentally double-scanning the same receipt or order.

3. **Display in Transaction History & Details:**
   - In transaction detail or note:
     A subtle mono chip `🔖 tiktok#578129381293812` is displayed, allowing family members to cross-check orders directly in their shopping apps.

---

## 4. Security Rules (`firestore.rules`)

```ruby
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: is member of ledger
    function isLedgerMember(ledgerId) {
      return isAuthenticated() && (
        ledgerId == request.auth.uid ||
        request.auth.uid in get(/databases/$(database)/documents/ledgers/$(ledgerId)).data.members
      );
    }

    // Ledgers root collection
    match /ledgers/{ledgerId} {
      allow read: if isLedgerMember(ledgerId) || (
        isAuthenticated() && resource.data.inviteCode != null
      );
      allow create: if isAuthenticated();
      allow update: if isLedgerMember(ledgerId);
      allow delete: if isAuthenticated() && resource.data.ownerUid == request.auth.uid;

      match /accounts/{accountId} {
        allow read, create: if isLedgerMember(ledgerId);
        allow update: if isLedgerMember(ledgerId) && request.resource.data.kind == resource.data.kind;
        allow delete: if false;
      }

      match /categories/{categoryId} {
        allow read, create: if isLedgerMember(ledgerId);
        allow update: if isLedgerMember(ledgerId) && request.resource.data.type == resource.data.type;
        allow delete: if false;
      }

      match /transactions/{transactionId} {
        allow read, write: if isLedgerMember(ledgerId);
      }
    }

    // Legacy user collections (preserved for backward compatibility)
    match /users/{uid} {
      allow read, write: if isAuthenticated() && request.auth.uid == uid;
      match /{allSubcollections=**} {
        allow read, write: if isAuthenticated() && request.auth.uid == uid;
      }
    }

    // Quota scan usage
    match /scanUsage/{usageId} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

---

## 5. Verification & Quality Gates

1. **Gate 1: Schema & Unit Tests**
   - `schemas.test.ts` validates `createdBy` object, ensuring name/uid constraints.
   - `ledgerService.test.ts` verifies invite code generation (6 chars, uppercase alphanumeric), member addition, and duplicate prevention.
2. **Gate 2: Balance & Atomicity**
   - Transactions added by any family member atomically adjust the shared account balance.
3. **Gate 3: Visual & Token Audit (Gate 12)**
   - Created-by badges use semantic tokens (`var(--surface-secondary)`, `var(--muted-foreground)`, `var(--radius-full)`). Zero raw hex.
4. **Gate 4: E2E Collaboration Test**
   - User A creates ledger and invites User B with code `XYZ123`.
   - User B joins ledger.
   - User B scans/creates transaction -> User A sees transaction with `createdBy: User B`.
   - Balance reflects in both sessions.

---

## 6. Implementation Stages (Preview for writing-plans)
- **Phase 1: Domain & Schema** (`schemas.ts`, `ledgerService.ts`, unit tests).
- **Phase 2: Security Rules & Migration** (`firestore.rules`, emulator verification).
- **Phase 3: Repository Wiring** (`transactionService.ts` to attach `createdBy` and scope to `activeLedgerId`).
- **Phase 4: UI Components** (`FamilyLedgerSheet.tsx`, Join Dialog, Dashboard creator badge).
- **Phase 5: E2E Verification & Deployment**.
