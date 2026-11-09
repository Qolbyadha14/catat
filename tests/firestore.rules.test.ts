import { describe, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
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

    it('Daftar admin tidak bisa dibaca user biasa; tiap user hanya bisa membaca dokumen adminnya sendiri', async () => {
      const regularDb = testEnv.authenticatedContext('user-regular').firestore();
      await assertFails(getDoc(doc(regularDb, 'system_admins/user-admin')));
      await assertFails(getDocs(collection(regularDb, 'system_admins')));
      await assertSucceeds(getDoc(doc(regularDb, 'system_admins/user-regular')));

      const adminDb = testEnv.authenticatedContext('user-admin').firestore();
      await assertSucceeds(getDoc(doc(adminDb, 'system_admins/user-admin')));
    });
  });
});


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
