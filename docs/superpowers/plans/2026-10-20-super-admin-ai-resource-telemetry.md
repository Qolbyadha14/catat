# Super Admin & AI Resource Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, real-time Super Admin panel (`/admin`) and AI Telemetry engine to monitor and manage Google Gemini AI resource usage (OCR & NLP), enforce dynamic system configurations, inspect user activity/quotas, and provide kill-switch controls.

**Architecture:** A client-side Firestore telemetry and dynamic configuration hub. Telemetry events are captured fire-and-forget in `ai_logs` collection. System configurations are read from `system_config/global` with fallback defaults. Authorization is governed by `system_admins/{uid}` in Firestore Security Rules and a `useSuperAdmin` hook. The dashboard is rendered inside Catat with Obsidian-themed tabs (AI Telemetry, Users & Ledgers, System Controls).

**Tech Stack:** React 19, TypeScript, Cloud Firestore (Firebase v13), Tailwind CSS v4, Lucide Icons, Bun test runner.

## Global Constraints
- All Firestore writes in telemetry must be fire-and-forget (never throw or disrupt user transaction/OCR flow).
- Use `system_admins/{uid}` document existence to gate admin capabilities in Firestore rules.
- Maintain 100% backward compatibility with existing tests (`bun test src/`).
- No placeholder code ("TODO", "TBD").
- Keep lines focused and modular, matching Catat's fintech Obsidian styling (`bg-stone-950`, `border-stone-800`, `text-stone-100`).

---

### Task 1: Firestore Security Rules & Admin Access Control

**Files:**
- Modify: `firestore.rules`
- Test: `tests/firestore.rules.test.ts`

**Interfaces:**
- Consumes: Firebase Security Rules `request.auth`, `exists()`
- Produces: `isSuperAdmin()` rule helper, permissions for `system_admins`, `system_config`, and `ai_logs`

- [ ] **Step 1: Write the failing security rules tests**

Add test cases in `tests/firestore.rules.test.ts` to verify:
1. Normal user cannot read or write `system_config/global`.
2. Super admin (user whose UID exists in `/system_admins/{uid}`) can read and write `system_config/global`.
3. Normal user can create their own log in `/ai_logs/{logId}` where `data.uid == request.auth.uid`, but cannot read any logs.
4. Super admin can read `/ai_logs`.
5. Super admin can read `/users` and `/ledgers`.

- [ ] **Step 2: Run rules test to verify it fails**

Run: `bun test tests/firestore.rules.test.ts`
Expected: FAIL with permission denied or missing rules for `system_config` / `ai_logs`.

- [ ] **Step 3: Update `firestore.rules`**

Add:
```javascript
function isSuperAdmin() {
  return isAuthenticated() && exists(/databases/$(database)/documents/system_admins/$(request.auth.uid));
}

match /system_admins/{adminUid} {
  allow read: if isAuthenticated();
  allow write: if false; // Provisioned via console/seed
}

match /system_config/{configId} {
  allow read: if isAuthenticated();
  allow write: if isSuperAdmin();
}

match /ai_logs/{logId} {
  allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
  allow read, delete: if isSuperAdmin();
  allow update: if false;
}
```
Update `/users/{uid}` and `/ledgers/{ledgerId}` matches to allow read if `isSuperAdmin()`.

- [ ] **Step 4: Run rules test to verify it passes**

Run: `bun test tests/firestore.rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.ts
git commit -m "feat(security): add superadmin, system_config, and ai_logs firestore rules"
```

---

### Task 2: Dynamic System Configuration Service

**Files:**
- Create: `src/lib/config/systemConfigService.ts`
- Test: `src/lib/config/systemConfigService.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface SystemConfig {
    dailyOcrLimit: number;
    defaultOcrModel: string;
    fallbackOcrModel: string;
    aiKillSwitch: boolean;
    updatedAt: string;
    updatedBy: string;
  }
  export const DEFAULT_SYSTEM_CONFIG: SystemConfig;
  export function getSystemConfig(): Promise<SystemConfig>;
  export function subscribeSystemConfig(callback: (config: SystemConfig) => void): () => void;
  export function updateSystemConfig(updates: Partial<SystemConfig>, adminUid: string): Promise<void>;
  ```

- [ ] **Step 1: Write unit tests for `systemConfigService`**

Write tests in `src/lib/config/systemConfigService.test.ts` covering:
- Returns `DEFAULT_SYSTEM_CONFIG` when doc does not exist.
- Returns merged configuration when Firestore doc exists.
- In-memory cache returns synchronous/fast fallback if offline.
- `updateSystemConfig` writes updates with timestamp and updatedBy.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/config/systemConfigService.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/config/systemConfigService.ts`**

Implement Firestore doc getter (`doc(db, 'system_config', 'global')`), fallback defaults, real-time subscriber (`onSnapshot`), and updater (`setDoc` with `merge: true`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/config/systemConfigService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/systemConfigService.ts src/lib/config/systemConfigService.test.ts
git commit -m "feat(config): implement dynamic system configuration service"
```

---

### Task 3: AI Telemetry Logging Service

**Files:**
- Create: `src/lib/telemetry/telemetryService.ts`
- Test: `src/lib/telemetry/telemetryService.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AiLogPayload {
    uid: string;
    userEmail?: string;
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
  export interface AiLogEntry extends AiLogPayload {
    id: string;
    timestamp: number;
    dateKey: string;
  }
  export interface AiTelemetrySummary {
    totalCalls: number;
    ocrCalls: number;
    nlpCalls: number;
    successCount: number;
    fallbackCount: number;
    errorCount: number;
    avgDurationMs: number;
    totalTokens: number;
  }
  export function logAiUsage(payload: AiLogPayload): Promise<void>;
  export function subscribeAiLogs(callback: (logs: AiLogEntry[]) => void, limitCount?: number): () => void;
  export function calculateTelemetrySummary(logs: AiLogEntry[]): AiTelemetrySummary;
  ```

- [ ] **Step 1: Write unit tests for `telemetryService`**

Write tests in `src/lib/telemetry/telemetryService.test.ts` testing:
- `logAiUsage` correctly forms log entry with `timestamp` and `dateKey`.
- `logAiUsage` catches and swallows any Firestore error without throwing (fire-and-forget guarantee).
- `calculateTelemetrySummary` correctly aggregates total calls, success/fallback/error counts, averages, and tokens.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/telemetry/telemetryService.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/telemetry/telemetryService.ts`**

Implement `logAiUsage` with fire-and-forget try/catch, `addDoc(collection(db, 'ai_logs'), ...)`. Implement `subscribeAiLogs` using `query(collection(db, 'ai_logs'), orderBy('timestamp', 'desc'), limit(limitCount))` and `calculateTelemetrySummary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/telemetry/telemetryService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/telemetry/telemetryService.ts src/lib/telemetry/telemetryService.test.ts
git commit -m "feat(telemetry): implement ai telemetry logging service and summary calculator"
```

---

### Task 4: Integrate Telemetry & Dynamic Config into Gemini OCR & NLP Services

**Files:**
- Modify: `src/lib/ocr/geminiService.ts`
- Modify: `src/lib/nlp/textAssistantService.ts`
- Test: `src/lib/ocr/geminiService.test.ts`
- Test: `src/lib/nlp/textAssistantService.test.ts`

**Interfaces:**
- Consumes: `getSystemConfig` from `src/lib/config/systemConfigService.ts`, `logAiUsage` from `src/lib/telemetry/telemetryService.ts`

- [ ] **Step 1: Write integration tests in `geminiService.test.ts` & `textAssistantService.test.ts`**

Test that:
- When `aiKillSwitch` is true, `scanReceiptWithGemini` immediately throws/returns polite notice without calling Gemini.
- When `scanReceiptWithGemini` completes, it logs telemetry.
- Dynamic daily limit from config is respected.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/ocr/geminiService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement integration in `geminiService.ts` and `textAssistantService.ts`**

- In `geminiService.ts`:
  - Replace static `OCR_DAILY_LIMIT` in quota checks with dynamic `config.dailyOcrLimit`.
  - In `scanReceiptWithGemini`, record start time with `performance.now()`.
  - On kill switch, abort gracefully.
  - On success, call `logAiUsage({ feature: 'ocr', status: 'success', durationMs, model, tokensUsed })`.
  - On fallback, call `logAiUsage({ feature: 'ocr', status: 'fallback', durationMs, model: FALLBACK_OCR_MODEL })`.
  - On catch error, call `logAiUsage({ feature: 'ocr', status: 'error', durationMs, model, errorMsg })`.
- In `textAssistantService.ts`:
  - In `parseTransaction`, record duration and call `logAiUsage({ feature: 'nlp', ... })`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/ocr/geminiService.test.ts && bun test src/lib/nlp/textAssistantService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocr/geminiService.ts src/lib/nlp/textAssistantService.ts src/lib/ocr/geminiService.test.ts src/lib/nlp/textAssistantService.test.ts
git commit -m "feat(ai): integrate dynamic config and telemetry into gemini ocr and nlp parser"
```

---

### Task 5: User Profile Metadata Enrichment & `useSuperAdmin` Hook

**Files:**
- Modify: `src/features/auth/seedDefaults.ts`
- Modify: `src/features/auth/useAuth.ts`
- Create: `src/features/auth/useSuperAdmin.ts`
- Test: `src/features/auth/useSuperAdmin.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface SuperAdminState {
    isSuperAdmin: boolean;
    loading: boolean;
  }
  export function useSuperAdmin(uid?: string | null): SuperAdminState;
  ```

- [ ] **Step 1: Write test for `useSuperAdmin`**

Test that:
- Returns `isSuperAdmin: false` when uid is null or doc not in `system_admins`.
- Returns `isSuperAdmin: true` when doc exists in `system_admins`.
- Handles showcase mode cleanly.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/auth/useSuperAdmin.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `useSuperAdmin.ts` and enhance `seedDefaults.ts`**

- In `seedDefaults.ts`, update `ensureUserDefaults(user: User)` so it writes `email`, `displayName`, `photoURL`, `lastActiveAt: Date.now()`.
- Implement `useSuperAdmin.ts` subscribing to `doc(db, 'system_admins', uid)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/auth/useSuperAdmin.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/seedDefaults.ts src/features/auth/useAuth.ts src/features/auth/useSuperAdmin.ts src/features/auth/useSuperAdmin.test.ts
git commit -m "feat(auth): enrich user profile metadata and implement useSuperAdmin hook"
```

---

### Task 6: Super Admin UI Dashboard & Tabs

**Files:**
- Create: `src/features/admin/AdminDashboardView.tsx`
- Create: `src/features/admin/AiTelemetryTab.tsx`
- Create: `src/features/admin/UsersLedgersTab.tsx`
- Create: `src/features/admin/SystemControlsTab.tsx`
- Test: `src/features/admin/AdminDashboardView.test.tsx`

**Interfaces:**
- Produces: `<AdminDashboardView user={user} onBackToApp={() => void} />`
- Visual Design: Dark obsidian theme (`bg-stone-950`, `border-stone-800`, `text-stone-100`), Lucide icons (`Activity`, `Users`, `Sliders`, `ShieldAlert`, `RefreshCw`, `Search`).

- [ ] **Step 1: Write render tests for `AdminDashboardView`**

Test in `src/features/admin/AdminDashboardView.test.tsx`:
- Renders header and 3 tabs: AI Telemetry, Users & Ledgers, System Controls.
- Tab switching updates active content.
- KPI cards render metrics correctly.
- Filter chips (All / OCR / NLP / Errors) filter the log list.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/admin/AdminDashboardView.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement Admin Dashboard & Tabs**

- `AiTelemetryTab.tsx`: 4 KPI cards (Total Calls, Success Rate %, Avg Duration ms, Est. Tokens) + Audit Log Table with real-time stream, status badges, and search filter.
- `UsersLedgersTab.tsx`: Table of users with quota usage for today, "Reset Kuota" button (resets `scanUsage/{uid}_{dateKey}`), and list of family ledgers.
- `SystemControlsTab.tsx`: Form to edit `dailyOcrLimit`, select default Gemini model, toggle `aiKillSwitch` with confirmation dialog, and save button.
- `AdminDashboardView.tsx`: Main container with tab switcher and return button.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/admin/AdminDashboardView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/
git commit -m "feat(admin): build super admin dashboard view and telemetry tabs"
```

---

### Task 7: Navigation & App Routing Integration

**Files:**
- Modify: `src/features/dashboard/ProfileMenuPopover.tsx`
- Modify: `src/features/dashboard/DashboardView.tsx`
- Modify: `src/App.tsx`
- Test: `tests/e2e-gates.test.ts`

**Interfaces:**
- Consumes: `useSuperAdmin` from `src/features/auth/useSuperAdmin`
- Produces: Profile menu "Admin Dashboard" entry for Super Admins, seamless switching between User Dashboard and Super Admin view in `App.tsx`.

- [ ] **Step 1: Write integration test**

Verify in `tests/e2e-gates.test.ts` that:
- Non-admin profile popover does not show "Admin Dashboard".
- Super admin profile popover shows "Admin Dashboard".
- Switching view opens `AdminDashboardView`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/e2e-gates.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement routing and popover entry**

- In `ProfileMenuPopover.tsx`: Add "Admin Dashboard" item with `ShieldCheck` icon if `isSuperAdmin` is true.
- In `DashboardView.tsx`: Add `onOpenAdmin` handler.
- In `App.tsx`: Manage `currentView: 'app' | 'admin'`. If `'admin'` and user is superadmin, render `AdminDashboardView`. If user is not superadmin, fallback to `'app'`.

- [ ] **Step 4: Run full test suite to verify everything passes**

Run: `bun test src/`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/ProfileMenuPopover.tsx src/features/dashboard/DashboardView.tsx src/App.tsx tests/e2e-gates.test.ts
git commit -m "feat(nav): integrate admin dashboard navigation and view routing"
```
