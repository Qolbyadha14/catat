import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({}),
  }),
});

// ponytail: connect local emulators during development. Set VITE_USE_FIREBASE_EMULATOR=false to hit cloud.
const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
const isDev = Boolean(import.meta.env.DEV ?? (proc?.env?.NODE_ENV !== 'production'));
const isTest = Boolean(proc?.env?.NODE_ENV === 'test' || proc?.env?.BUN_ENV === 'test' || proc?.env?.FIREBASE_AUTH_EMULATOR_HOST);
if (isTest || (isDev && import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false')) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export const RECAPTCHA_ENTERPRISE_SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY ?? '6LeeOPMtAAAAAHCpJLmuT4kkAAd9yNMLgPuyoP-N';

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
