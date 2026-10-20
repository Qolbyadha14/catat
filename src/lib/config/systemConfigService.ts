import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface SystemConfig {
  dailyOcrLimit: number;
  defaultOcrModel: string;
  fallbackOcrModel: string;
  aiKillSwitch: boolean;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  dailyOcrLimit: 20,
  defaultOcrModel: 'gemini-3.5-flash-lite',
  fallbackOcrModel: 'gemini-3.5-flash',
  aiKillSwitch: false,
  updatedAt: '2026-10-20T00:00:00.000Z',
  updatedBy: 'system_default',
};

// In-memory cache for ultra-fast, synchronous access
let cachedConfig: SystemConfig = { ...DEFAULT_SYSTEM_CONFIG };

export function resolveMergedConfig(raw: unknown): SystemConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SYSTEM_CONFIG };
  }

  const data = raw as Record<string, unknown>;

  const dailyOcrLimit =
    typeof data.dailyOcrLimit === 'number' && data.dailyOcrLimit > 0
      ? Math.floor(data.dailyOcrLimit)
      : DEFAULT_SYSTEM_CONFIG.dailyOcrLimit;

  const defaultOcrModel =
    typeof data.defaultOcrModel === 'string' && data.defaultOcrModel.trim().length > 0
      ? data.defaultOcrModel.trim()
      : DEFAULT_SYSTEM_CONFIG.defaultOcrModel;

  const fallbackOcrModel =
    typeof data.fallbackOcrModel === 'string' && data.fallbackOcrModel.trim().length > 0
      ? data.fallbackOcrModel.trim()
      : DEFAULT_SYSTEM_CONFIG.fallbackOcrModel;

  const aiKillSwitch =
    typeof data.aiKillSwitch === 'boolean'
      ? data.aiKillSwitch
      : DEFAULT_SYSTEM_CONFIG.aiKillSwitch;

  const updatedAt =
    typeof data.updatedAt === 'string'
      ? data.updatedAt
      : DEFAULT_SYSTEM_CONFIG.updatedAt;

  const updatedBy =
    typeof data.updatedBy === 'string'
      ? data.updatedBy
      : DEFAULT_SYSTEM_CONFIG.updatedBy;

  return {
    dailyOcrLimit,
    defaultOcrModel,
    fallbackOcrModel,
    aiKillSwitch,
    updatedAt,
    updatedBy,
  };
}

export function getCachedSystemConfig(): SystemConfig {
  return cachedConfig;
}

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const configRef = doc(db, 'system_config', 'global');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      cachedConfig = resolveMergedConfig(snap.data());
    }
  } catch (err) {
    console.warn('Gagal membaca system_config dari Firestore, menggunakan fallback cache:', err);
  }
  return cachedConfig;
}

export function subscribeSystemConfig(callback: (config: SystemConfig) => void): () => void {
  try {
    const configRef = doc(db, 'system_config', 'global');
    return onSnapshot(
      configRef,
      (snap) => {
        if (snap.exists()) {
          cachedConfig = resolveMergedConfig(snap.data());
        } else {
          cachedConfig = { ...DEFAULT_SYSTEM_CONFIG };
        }
        callback(cachedConfig);
      },
      (error) => {
        console.warn('Error saat subscribe system_config:', error);
        callback(cachedConfig);
      }
    );
  } catch (err) {
    console.warn('Gagal inisialisasi onSnapshot system_config:', err);
    callback(cachedConfig);
    return () => {};
  }
}

export async function updateSystemConfig(
  updates: Partial<SystemConfig>,
  adminUid: string
): Promise<void> {
  const configRef = doc(db, 'system_config', 'global');
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  };
  await setDoc(configRef, payload, { merge: true });
  cachedConfig = resolveMergedConfig({ ...cachedConfig, ...payload });
}
