import { describe, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

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
        type: 'cash',
        balance: 100000,
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
});
