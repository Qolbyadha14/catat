const DAILY_LIMIT = 20;
const STORAGE_PREFIX = 'catat_ocr_scans';
const DISCLOSURE_PREFIX = 'catat_ocr_disclosure';

function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // localStorage restricted or disabled
  }
  return null;
}

export function getScanCount(userId: string, dateKey: string = getTodayKey()): number {
  const storage = getSafeStorage();
  if (!storage) return 0;
  const raw = storage.getItem(`${STORAGE_PREFIX}_${userId}_${dateKey}`);
  const val = Number.parseInt(raw || '0', 10);
  return Number.isNaN(val) ? 0 : val;
}

export function canScan(userId: string, dateKey: string = getTodayKey(), limit = DAILY_LIMIT): boolean {
  return getScanCount(userId, dateKey) < limit;
}

export function getRemainingScans(userId: string, dateKey: string = getTodayKey(), limit = DAILY_LIMIT): number {
  const used = getScanCount(userId, dateKey);
  return Math.max(0, limit - used);
}

export function recordScan(userId: string, dateKey: string = getTodayKey()): number {
  const storage = getSafeStorage();
  const current = getScanCount(userId, dateKey);
  const next = current + 1;
  if (storage) {
    try {
      storage.setItem(`${STORAGE_PREFIX}_${userId}_${dateKey}`, String(next));
    } catch {
      // Storage quota exceeded
    }
  }
  return next;
}

export function hasAcceptedDisclosure(userId: string): boolean {
  const storage = getSafeStorage();
  if (!storage) return false;
  return storage.getItem(`${DISCLOSURE_PREFIX}_${userId}`) === 'true';
}

export function acceptDisclosure(userId: string): void {
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(`${DISCLOSURE_PREFIX}_${userId}`, 'true');
    } catch {
      // ignore
    }
  }
}

export function resetScanCounterForTest(userId: string, dateKey: string = getTodayKey()): void {
  const storage = getSafeStorage();
  if (storage) {
    storage.removeItem(`${STORAGE_PREFIX}_${userId}_${dateKey}`);
    storage.removeItem(`${DISCLOSURE_PREFIX}_${userId}`);
  }
}
