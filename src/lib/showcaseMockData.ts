import type { User } from 'firebase/auth';
import type { Account, Category, Transaction, Ledger } from './schemas';

export function isShowcaseMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.has('demo') ||
    params.has('showcase') ||
    localStorage.getItem('catat_showcase_mode') === 'true'
  );
}

export const MOCK_SHOWCASE_USER = {
  uid: 'showcase-mock-user',
  email: 'qolby@coreboylabs.com',
  displayName: 'Qolby Adha',
  photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Qolby',
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'mock-token',
  getIdTokenResult: async () => ({ token: 'mock-token' } as any),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  providerId: 'google.com',
} as unknown as User;

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();

function makeDate(day: number, hour = 12): number {
  return new Date(currentYear, currentMonth, day, hour, 0, 0, 0).getTime();
}

export const MOCK_SHOWCASE_ACCOUNTS: Account[] = [
  { id: 'acc_bca', name: 'Bank BCA', kind: 'asset', balance: 16500000, icon: '🏦', isArchived: false, createdAt: makeDate(1) },
  { id: 'acc_mandiri', name: 'Bank Mandiri', kind: 'asset', balance: 5250000, icon: '🏛️', isArchived: false, createdAt: makeDate(1) },
  { id: 'acc_gopay', name: 'GoPay Saldo', kind: 'asset', balance: 1850000, icon: '📱', isArchived: false, createdAt: makeDate(1) },
  { id: 'acc_cash', name: 'Dompet Tunai', kind: 'asset', balance: 900000, icon: '💵', isArchived: false, createdAt: makeDate(1) },
  { id: 'acc_paylater', name: 'Shopee PayLater', kind: 'liability', balance: 750000, icon: '🛍️', dueDay: 25, isArchived: false, createdAt: makeDate(1) },
  { id: 'acc_bca_cc', name: 'BCA Everyday Card', kind: 'liability', balance: 1200000, icon: '💳', dueDay: 15, isArchived: false, createdAt: makeDate(1) },
];

export const MOCK_SHOWCASE_CATEGORIES: Category[] = [
  // Income
  { id: 'cat_salary', name: 'Gaji Utama', type: 'income', icon: '💰', isArchived: false, createdAt: makeDate(1) },
  { id: 'cat_freelance', name: 'Project Side-Hustle', type: 'income', icon: '💻', isArchived: false, createdAt: makeDate(1) },
  // Expense with Budgets
  { id: 'cat_food', name: 'Makan & Minum', type: 'expense', icon: '🍔', monthlyBudget: 3500000, isArchived: false, createdAt: makeDate(1) },
  { id: 'cat_groceries', name: 'Sembako & Dapur', type: 'expense', icon: '🥦', monthlyBudget: 2500000, isArchived: false, createdAt: makeDate(1) },
  { id: 'cat_bills', name: 'Tagihan & Utilitas', type: 'expense', icon: '💡', monthlyBudget: 1500000, isArchived: false, createdAt: makeDate(1) },
  { id: 'cat_transport', name: 'Transportasi', type: 'expense', icon: '🚗', monthlyBudget: 1000000, isArchived: false, createdAt: makeDate(1) },
  { id: 'cat_entertainment', name: 'Hiburan & Streaming', type: 'expense', icon: '🎬', monthlyBudget: 500000, isArchived: false, createdAt: makeDate(1) },
  { id: 'cat_health', name: 'Kesehatan & Apotek', type: 'expense', icon: '💊', monthlyBudget: 750000, isArchived: false, createdAt: makeDate(1) },
];

export const MOCK_SHOWCASE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_salary',
    type: 'income',
    amount: 15000000,
    accountId: 'acc_bca',
    categoryId: 'cat_salary',
    date: makeDate(1, 9),
    note: 'Gaji Bulanan Oktober',
    createdAt: makeDate(1, 9),
    updatedAt: makeDate(1, 9),
  },
  {
    id: 'tx_freelance',
    type: 'income',
    amount: 3500000,
    accountId: 'acc_mandiri',
    categoryId: 'cat_freelance',
    date: makeDate(5, 14),
    note: 'Pelunasan Desain Mobile App',
    createdAt: makeDate(5, 14),
    updatedAt: makeDate(5, 14),
  },
  {
    id: 'tx_groceries_1',
    type: 'expense',
    amount: 1250000,
    accountId: 'acc_bca',
    categoryId: 'cat_groceries',
    date: makeDate(7, 11),
    note: 'Belanja Bulanan Superindo',
    createdAt: makeDate(7, 11),
    updatedAt: makeDate(7, 11),
  },
  {
    id: 'tx_food_dinner',
    type: 'expense',
    amount: 480000,
    accountId: 'acc_bca_cc',
    categoryId: 'cat_food',
    date: makeDate(10, 19),
    note: 'Makan Malam Sushi Tei',
    createdAt: makeDate(10, 19),
    updatedAt: makeDate(10, 19),
  },
  {
    id: 'tx_bills_wifi',
    type: 'expense',
    amount: 850000,
    accountId: 'acc_mandiri',
    categoryId: 'cat_bills',
    date: makeDate(12, 10),
    note: 'Listrik PLN & FirstMedia',
    createdAt: makeDate(12, 10),
    updatedAt: makeDate(12, 10),
  },
  {
    id: 'tx_fuel',
    type: 'expense',
    amount: 350000,
    accountId: 'acc_gopay',
    categoryId: 'cat_transport',
    date: makeDate(14, 8),
    note: 'Bensin Pertamax Full Tank',
    createdAt: makeDate(14, 8),
    updatedAt: makeDate(14, 8),
  },
  {
    id: 'tx_coffee',
    type: 'expense',
    amount: 65000,
    accountId: 'acc_gopay',
    categoryId: 'cat_food',
    date: makeDate(16, 15),
    note: 'Kopi Kenangan Mantan x2',
    createdAt: makeDate(16, 15),
    updatedAt: makeDate(16, 15),
  },
  {
    id: 'tx_netflix',
    type: 'expense',
    amount: 239000,
    accountId: 'acc_bca_cc',
    categoryId: 'cat_entertainment',
    date: makeDate(17, 20),
    note: 'Langganan Netflix Premium',
    createdAt: makeDate(17, 20),
    updatedAt: makeDate(17, 20),
  },
  {
    id: 'tx_vegetables',
    type: 'expense',
    amount: 185000,
    accountId: 'acc_cash',
    categoryId: 'cat_groceries',
    date: makeDate(18, 7),
    note: 'Sayur Segar & Buah Pasar',
    createdAt: makeDate(18, 7),
    updatedAt: makeDate(18, 7),
  },
  {
    id: 'tx_lunch_padang',
    type: 'expense',
    amount: 75000,
    accountId: 'acc_cash',
    categoryId: 'cat_food',
    date: makeDate(19, 13),
    note: 'Makan Siang Nasi Padang Pagi Sore',
    createdAt: makeDate(19, 13),
    updatedAt: makeDate(19, 13),
  },
  {
    id: 'tx_transfer_topup',
    type: 'transfer',
    amount: 500000,
    fromAccountId: 'acc_bca',
    toAccountId: 'acc_gopay',
    date: makeDate(20, 10),
    note: 'Top up Saldo GoPay',
    createdAt: makeDate(20, 10),
    updatedAt: makeDate(20, 10),
  },
];

export const MOCK_SHOWCASE_LEDGER: Ledger = {
  id: 'ledger_coreboy_family',
  name: 'Buku Kas Keluarga',
  ownerUid: 'showcase-mock-user',
  inviteCode: 'CATAT88',
  members: {
    'showcase-mock-user': {
      uid: 'showcase-mock-user',
      name: 'Qolby Adha',
      email: 'qolby@coreboylabs.com',
      role: 'owner',
      joinedAt: makeDate(1),
    },
    'member_partner': {
      uid: 'member_partner',
      name: 'Sarah Nabila',
      email: 'sarah@coreboylabs.com',
      role: 'member',
      joinedAt: makeDate(2),
    },
  },
  createdAt: makeDate(1),
  updatedAt: makeDate(20),
};
