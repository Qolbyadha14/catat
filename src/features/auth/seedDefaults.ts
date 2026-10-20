import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Account, Category } from '../../lib/schemas';

interface SeedAccount extends Account {}
interface SeedCategory extends Category {}

const DEFAULT_ACCOUNTS: Omit<SeedAccount, 'createdAt'>[] = [
  { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 0, icon: '💵', isArchived: false },
  { id: 'acc_bank', name: 'Rekening Utama', kind: 'asset', balance: 0, icon: '🏦', isArchived: false },
  { id: 'acc_ewallet', name: 'Dompet Digital', kind: 'asset', balance: 0, icon: '📱', isArchived: false },
  { id: 'acc_cimb_cc', name: 'CIMB Niaga CC', kind: 'liability', balance: 0, icon: '💳', isArchived: false },
  { id: 'acc_cimb_kta', name: 'CIMB Niaga KTA', kind: 'liability', balance: 0, icon: '📑', isArchived: false },
  { id: 'acc_tiktok_paylater', name: 'TikTok PayLater', kind: 'liability', balance: 0, icon: '🎵', isArchived: false },
  { id: 'acc_paylater', name: 'Shopee PayLater', kind: 'liability', balance: 0, icon: '🛍️', isArchived: false },
  { id: 'acc_bca_cc', name: 'BCA CC', kind: 'liability', balance: 0, icon: '💳', isArchived: false },
];

const DEFAULT_CATEGORIES: Omit<SeedCategory, 'createdAt'>[] = [
  // Pengeluaran
  { id: 'cat_groceries', name: 'Sembako & Dapur', type: 'expense', icon: '🥦', isArchived: false },
  { id: 'cat_food', name: 'Makan & Minum', type: 'expense', icon: '🍔', isArchived: false },
  { id: 'cat_transport', name: 'Transportasi', type: 'expense', icon: '🚗', isArchived: false },
  { id: 'cat_shopping', name: 'Belanja & Olshop', type: 'expense', icon: '🛍️', isArchived: false },
  { id: 'cat_bills', name: 'Tagihan & Utilitas', type: 'expense', icon: '💡', isArchived: false },
  { id: 'cat_education', name: 'Pendidikan & Anak', type: 'expense', icon: '📚', isArchived: false },
  { id: 'cat_health', name: 'Kesehatan', type: 'expense', icon: '💊', isArchived: false },
  { id: 'cat_entertainment', name: 'Hiburan', type: 'expense', icon: '🎬', isArchived: false },
  { id: 'cat_charity', name: 'Donasi & Sedekah', type: 'expense', icon: '🤲', isArchived: false },
  { id: 'cat_installment', name: 'Cicilan & Hutang', type: 'expense', icon: '💳', isArchived: false },
  // Pemasukan
  { id: 'cat_salary', name: 'Gaji Utama', type: 'income', icon: '💰', isArchived: false },
  { id: 'cat_business', name: 'Usaha & Jualan', type: 'income', icon: '💼', isArchived: false },
  { id: 'cat_bonus', name: 'Bonus & THR', type: 'income', icon: '🎁', isArchived: false },
  { id: 'cat_other_income', name: 'Pemasukan Lain', type: 'income', icon: '📈', isArchived: false },
];

export interface UserProfileSeed {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export async function ensureUserDefaults(userOrUid: string | UserProfileSeed): Promise<void> {
  const uid = typeof userOrUid === 'string' ? userOrUid : userOrUid.uid;
  const email = typeof userOrUid === 'string' ? '' : (userOrUid.email || '');
  const displayName = typeof userOrUid === 'string' ? '' : (userOrUid.displayName || '');
  const photoURL = typeof userOrUid === 'string' ? '' : (userOrUid.photoURL || '');

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  const now = Date.now();
  const batch = writeBatch(db);

  if (!userSnap.exists()) {
    // Marker doc
    batch.set(userRef, {
      uid,
      email,
      displayName,
      photoURL,
      createdAt: now,
      lastActiveAt: now,
      seeded: true,
    });

    // Default categories for new users
    for (const cat of DEFAULT_CATEGORIES) {
      const catRef = doc(db, 'users', uid, 'categories', cat.id);
      batch.set(catRef, { ...cat, createdAt: now });
    }
  } else {
    batch.set(
      userRef,
      {
        uid,
        ...(email ? { email } : {}),
        ...(displayName ? { displayName } : {}),
        ...(photoURL ? { photoURL } : {}),
        lastActiveAt: now,
      },
      { merge: true }
    );
  }


  // Ensure all default accounts exist (idempotent for new and existing users)
  for (const acc of DEFAULT_ACCOUNTS) {
    const accRef = doc(db, 'users', uid, 'accounts', acc.id);
    const accSnap = await getDoc(accRef);
    if (!accSnap.exists()) {
      batch.set(accRef, { ...acc, createdAt: now });
    }
  }

  await batch.commit();
}

export async function ensureLedgerDefaults(ledgerId: string): Promise<void> {
  const accCashSnap = await getDoc(doc(db, 'ledgers', ledgerId, 'accounts', 'acc_cash'));
  const now = Date.now();
  const batch = writeBatch(db);

  if (!accCashSnap.exists()) {
    for (const cat of DEFAULT_CATEGORIES) {
      const catRef = doc(db, 'ledgers', ledgerId, 'categories', cat.id);
      batch.set(catRef, { ...cat, createdAt: now });
    }
  }

  for (const acc of DEFAULT_ACCOUNTS) {
    const accRef = doc(db, 'ledgers', ledgerId, 'accounts', acc.id);
    const aSnap = await getDoc(accRef);
    if (!aSnap.exists()) {
      batch.set(accRef, { ...acc, createdAt: now });
    }
  }

  await batch.commit();
}
