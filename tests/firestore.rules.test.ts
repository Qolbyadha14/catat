import { describe, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  testEnv = await initializeTestEnvironment({
    projectId: 'catat-rules-test',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Security Rules: User Isolation & Auth Guard', () => {
  it('Akses tanpa auth ditolak (unauthenticated read & write blocked)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/user-b'), { email: 'b@test.com' });
      await setDoc(doc(context.firestore(), 'users/user-b/accounts/acc_cash'), {
        name: 'Tunai',
        balance: 50000,
      });
    });

    const unauth = testEnv.unauthenticatedContext();
    const unauthDb = unauth.firestore();

    // Root doc
    await assertFails(getDoc(doc(unauthDb, 'users/user-b')));
    await assertFails(setDoc(doc(unauthDb, 'users/user-b'), { email: 'hacked@test.com' }));

    // Subcollections
    await assertFails(getDoc(doc(unauthDb, 'users/user-b/accounts/acc_cash')));
    await assertFails(
      setDoc(doc(unauthDb, 'users/user-b/transactions/tx_fake'), {
        amount: 100000,
        type: 'expense',
      }),
    );
  });

  it('Akses lintas uid ditolak (cross-uid IDOR read & write blocked)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/user-b'), { email: 'b@test.com' });
      await setDoc(doc(context.firestore(), 'users/user-b/accounts/acc_cash'), {
        name: 'Tunai',
        balance: 100000,
      });
    });

    const userA = testEnv.authenticatedContext('user-a');
    const userADb = userA.firestore();

    // User A accessing User B root doc
    await assertFails(getDoc(doc(userADb, 'users/user-b')));
    await assertFails(setDoc(doc(userADb, 'users/user-b'), { email: 'tampered@test.com' }));

    // User A accessing User B subcollections
    await assertFails(getDoc(doc(userADb, 'users/user-b/accounts/acc_cash')));
    await assertFails(
      setDoc(doc(userADb, 'users/user-b/transactions/tx_steal'), {
        amount: 999999,
        type: 'expense',
      }),
    );
    await assertFails(deleteDoc(doc(userADb, 'users/user-b/accounts/acc_cash')));
  });

  it('Akses pemilik sah diizinkan (own uid read & write allowed)', async () => {
    const userA = testEnv.authenticatedContext('user-a');
    const userADb = userA.firestore();

    // Root doc
    await assertSucceeds(
      setDoc(doc(userADb, 'users/user-a'), {
        email: 'user-a@example.com',
        createdAt: '2026-10-16T00:00:00.000Z',
      }),
    );
    await assertSucceeds(getDoc(doc(userADb, 'users/user-a')));

    // Subcollections (accounts, categories, transactions)
    await assertSucceeds(
      setDoc(doc(userADb, 'users/user-a/accounts/acc_cash'), {
        name: 'Tunai',
        kind: 'asset',
        balance: 100000,
        isArchived: false,
      }),
    );
    await assertSucceeds(getDoc(doc(userADb, 'users/user-a/accounts/acc_cash')));
    await assertSucceeds(
      setDoc(doc(userADb, 'users/user-a/transactions/tx_1'), {
        amount: 25000,
        type: 'expense',
      }),
    );
    await assertSucceeds(getDoc(doc(userADb, 'users/user-a/transactions/tx_1')));
  });

  it('Hard delete di accounts dan categories ditolak (archive-only)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/user-a/accounts/acc_cash'), {
        id: 'acc_cash',
        name: 'Tunai',
        kind: 'asset',
        balance: 0,
        isArchived: false,
      });
      await setDoc(doc(context.firestore(), 'users/user-a/categories/cat_food'), {
        id: 'cat_food',
        name: 'Makan',
        type: 'expense',
        isArchived: false,
      });
    });

    const userA = testEnv.authenticatedContext('user-a');
    const db = userA.firestore();

    await assertFails(deleteDoc(doc(db, 'users/user-a/accounts/acc_cash')));
    await assertFails(deleteDoc(doc(db, 'users/user-a/categories/cat_food')));
  });

  it('Immutability guard: ubah kind akun atau type kategori ditolak', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/user-a/accounts/acc_cash'), {
        id: 'acc_cash',
        name: 'Tunai',
        kind: 'asset',
        balance: 0,
        isArchived: false,
      });
      await setDoc(doc(context.firestore(), 'users/user-a/categories/cat_food'), {
        id: 'cat_food',
        name: 'Makan',
        type: 'expense',
        isArchived: false,
      });
    });

    const userA = testEnv.authenticatedContext('user-a');
    const db = userA.firestore();

    // Mutasi kind akun ditolak
    await assertFails(updateDoc(doc(db, 'users/user-a/accounts/acc_cash'), { kind: 'liability' }));

    // Mutasi type kategori ditolak
    await assertFails(updateDoc(doc(db, 'users/user-a/categories/cat_food'), { type: 'income' }));

    // Update mutable fields (name, icon, isArchived) diizinkan
    await assertSucceeds(
      updateDoc(doc(db, 'users/user-a/accounts/acc_cash'), {
        name: 'Kas Dompet',
        isArchived: true,
      })
    );
    await assertSucceeds(
      updateDoc(doc(db, 'users/user-a/categories/cat_food'), {
        name: 'Kuliner',
        icon: '🍜',
        isArchived: true,
      })
    );
  });

  describe('scanUsage Quota & Isolation Guard', () => {
    it('Update count <= 20 diizinkan untuk pemilik sah', async () => {
      const userA = testEnv.authenticatedContext('user-a');
      const dbA = userA.firestore();
      const usageRef = doc(dbA, 'scanUsage/user-a_2026-10-17');

      // Create awal count 1
      await assertSucceeds(setDoc(usageRef, { uid: 'user-a', count: 1 }));

      // Increment count sampai batas 20
      await assertSucceeds(updateDoc(usageRef, { count: 20 }));
    });

    it('Attempt count ke-21 ditolak (permission denied)', async () => {
      const userA = testEnv.authenticatedContext('user-a');
      const dbA = userA.firestore();
      const usageRef = doc(dbA, 'scanUsage/user-a_2026-10-17');

      // Create awal count 20
      await assertSucceeds(setDoc(usageRef, { uid: 'user-a', count: 20 }));

      // Increment ke 21 ditolak
      await assertFails(updateDoc(usageRef, { count: 21 }));

      // Create langsung dengan count > 20 juga ditolak
      const overLimitRef = doc(dbA, 'scanUsage/user-a_2026-10-18');
      await assertFails(setDoc(overLimitRef, { uid: 'user-a', count: 21 }));
    });

    it('User lain dilarang membaca atau memanipulasi usage milik UID berbeda', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'scanUsage/user-a_2026-10-17'), {
          uid: 'user-a',
          count: 5,
        });
      });

      const userB = testEnv.authenticatedContext('user-b');
      const dbB = userB.firestore();
      const targetRef = doc(dbB, 'scanUsage/user-a_2026-10-17');

      // Baca milik user-a ditolak
      await assertFails(getDoc(targetRef));

      // Update milik user-a ditolak
      await assertFails(updateDoc(targetRef, { count: 6 }));

      // Buat dokumen dengan id user-a dari auth user-b ditolak
      await assertFails(setDoc(targetRef, { uid: 'user-b', count: 1 }));
    });
  });

  describe('Firestore Security Rules: Super Admin, System Config, and AI Telemetry Logs', () => {
    beforeEach(async () => {
      // Seed superadmin user-admin into system_admins
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'system_admins/user-admin'), {
          email: 'admin@catat.com',
          role: 'superadmin',
          addedAt: Date.now(),
        });
        await setDoc(doc(context.firestore(), 'system_config/global'), {
          dailyOcrLimit: 20,
          defaultOcrModel: 'gemini-3.5-flash-lite',
          aiKillSwitch: false,
        });
        await setDoc(doc(context.firestore(), 'users/user-regular'), {
          email: 'reg@test.com',
          displayName: 'Regular User',
        });
        await setDoc(doc(context.firestore(), 'ledgers/ledger-family'), {
          name: 'Keluarga Bahagia',
          ownerUid: 'user-regular',
          members: ['user-regular'],
        });
      });
    });

    it('Normal user can read system_config/global but cannot write/update it', async () => {
      const userRegular = testEnv.authenticatedContext('user-regular');
      const db = userRegular.firestore();
      const configRef = doc(db, 'system_config/global');

      await assertSucceeds(getDoc(configRef));
      await assertFails(setDoc(configRef, { dailyOcrLimit: 50 }, { merge: true }));
      await assertFails(updateDoc(configRef, { dailyOcrLimit: 50 }));
    });

    it('Super admin can read and update system_config/global', async () => {
      const admin = testEnv.authenticatedContext('user-admin');
      const db = admin.firestore();
      const configRef = doc(db, 'system_config/global');

      await assertSucceeds(getDoc(configRef));
      await assertSucceeds(updateDoc(configRef, { dailyOcrLimit: 30 }));
    });

    it('Normal user can create their own ai_log but cannot read or update ai_logs', async () => {
      const userRegular = testEnv.authenticatedContext('user-regular');
      const db = userRegular.firestore();
      const myLogRef = doc(db, 'ai_logs/log-123');

      // Create own log succeeds
      await assertSucceeds(
        setDoc(myLogRef, {
          uid: 'user-regular',
          feature: 'ocr',
          model: 'gemini-3.5-flash-lite',
          durationMs: 1200,
          status: 'success',
          timestamp: Date.now(),
          dateKey: '2026-10-20',
        })
      );

      // Reading logs is denied to regular users
      await assertFails(getDoc(myLogRef));

      // Updating logs is denied
      await assertFails(updateDoc(myLogRef, { status: 'error' }));

      // Spoofing uid on create is denied
      const spoofLogRef = doc(db, 'ai_logs/log-spoof');
      await assertFails(
        setDoc(spoofLogRef, {
          uid: 'other-user',
          feature: 'ocr',
        })
      );
    });

    it('Super admin can read ai_logs, list users, and list ledgers', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'ai_logs/log-sample'), {
          uid: 'user-regular',
          feature: 'nlp',
          status: 'success',
        });
      });

      const admin = testEnv.authenticatedContext('user-admin');
      const db = admin.firestore();

      // Super admin can read ai_logs
      await assertSucceeds(getDoc(doc(db, 'ai_logs/log-sample')));

      // Super admin can read users directory
      await assertSucceeds(getDoc(doc(db, 'users/user-regular')));

      // Super admin can read family ledgers
      await assertSucceeds(getDoc(doc(db, 'ledgers/ledger-family')));
    });
  });
});

