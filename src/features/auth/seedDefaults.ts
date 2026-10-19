import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Account, Category } from '../../lib/schemas';

interface SeedAccount extends Account {}
interface SeedCategory extends Category {}

const DEFAULT_ACCOUNTS: Omit<SeedAccount, 'createdAt'>[] = [
  { id: 'acc_cash', name: 'Tunai', kind: 'asset', balance: 0, icon: '💵', isArchived: false },
  { id: 'acc_bank', name: 'Rekening Utama', kind: 'asset', balance: 0, icon: '🏦', isArchived: false },
  { id: 'acc_ewallet', name: 'Dompet Digital', kind: 'asset', balance: 0, icon: '📱', isArchived: false },
  { id: 'acc_paylater', name: 'SPayLater', kind: 'liability', balance: 0, icon: '💳', isArchived: false },
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

export async function ensureUserDefaults(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return;
  }

  const now = Date.now();
  const batch = writeBatch(db);

  // Marker doc
  batch.set(userRef, {
    uid,
    createdAt: now,
    seeded: true,
  });

  // Default accounts
  for (const acc of DEFAULT_ACCOUNTS) {
    const accRef = doc(db, 'users', uid, 'accounts', acc.id);
    batch.set(accRef, { ...acc, createdAt: now });
  }

  // Default categories
  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = doc(db, 'users', uid, 'categories', cat.id);
    batch.set(catRef, { ...cat, createdAt: now });
  }

  await batch.commit();
}

export async function ensureLedgerDefaults(ledgerId: string): Promise<void> {
  const accSnap = await getDoc(doc(db, 'ledgers', ledgerId, 'accounts', 'acc_cash'));
  if (accSnap.exists()) {
    return;
  }

  const now = Date.now();
  const batch = writeBatch(db);

  for (const acc of DEFAULT_ACCOUNTS) {
    const accRef = doc(db, 'ledgers', ledgerId, 'accounts', acc.id);
    batch.set(accRef, { ...acc, createdAt: now });
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = doc(db, 'ledgers', ledgerId, 'categories', cat.id);
    batch.set(catRef, { ...cat, createdAt: now });
  }

  await batch.commit();
}
