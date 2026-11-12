import { describe, expect, test } from 'bun:test';
import { omitUndefinedDeep } from '../../lib/omitUndefined';
import { transactionSchema, type Account, type Category, type Creator, type Transaction } from '../../lib/schemas';
import type { BatchReviewItem } from './batchReview';
import {
  buildBatchPayloads,
  buildQuickSavePayload,
  buildSubmitPayload,
  buildTransactionPayload,
  resolveCategoryAndAccount,
} from './transactionFormLogic';

const cat = (id: string, name: string, extra: Partial<Category> = {}): Category => ({
  id,
  name,
  type: 'expense',
  isArchived: false,
  createdAt: 1,
  ...extra,
});
const acc = (id: string, name: string, extra: Partial<Account> = {}): Account => ({
  id,
  name,
  kind: 'asset',
  balance: 0,
  isArchived: false,
  createdAt: 1,
  ...extra,
});

const categories = [
  cat('cat_old', 'Lama', { isArchived: true }),
  cat('cat_food', 'Makan & Minum'),
  cat('cat_other', 'Lainnya'),
  cat('cat_salary', 'Gaji', { type: 'income' }),
];
const accounts = [
  acc('acc_cash', 'Tunai'),
  acc('acc_jago', 'Bank Jago'),
  acc('acc_spay', 'Shopee PayLater', { kind: 'liability' }),
  acc('acc_gopay', 'GoPay'),
  acc('acc_old', 'Dompet Lama', { isArchived: true }),
];

const base = { categoryId: null, accountId: null, platform: 'other' as const, paymentMethod: null };

describe('resolveCategoryAndAccount', () => {
  test('memakai ID dari AI bila masih ada di daftar', () => {
    const r = resolveCategoryAndAccount({ ...base, categoryId: 'cat_other', accountId: 'acc_gopay' }, categories, accounts);
    expect(r).toEqual({ matchedCatId: 'cat_other', matchedAccId: 'acc_gopay' });
  });

  test('mengabaikan ID dari AI yang sudah tidak ada', () => {
    const r = resolveCategoryAndAccount({ ...base, categoryId: 'hilang', accountId: 'hilang' }, categories, accounts);
    expect(r.matchedCatId).toBe('cat_food');
    expect(r.matchedAccId).toBe('acc_cash');
  });

  test('platform makanan memilih kategori makan, bukan kategori pertama', () => {
    const reordered = [cat('cat_other', 'Lainnya'), cat('cat_food', 'Makan & Minum')];
    expect(resolveCategoryAndAccount({ ...base, platform: 'gofood' }, reordered, accounts).matchedCatId).toBe('cat_food');
    expect(resolveCategoryAndAccount({ ...base, platform: 'shopeefood' }, reordered, accounts).matchedCatId).toBe('cat_food');
    expect(resolveCategoryAndAccount(base, reordered, accounts).matchedCatId).toBe('cat_other');
  });

  test('SPayLater dan Bank Jago memilih akun yang cocok', () => {
    expect(resolveCategoryAndAccount({ ...base, platform: 'spaylater' }, categories, accounts).matchedAccId).toBe('acc_spay');
    expect(resolveCategoryAndAccount({ ...base, platform: 'bank_jago' }, categories, accounts).matchedAccId).toBe('acc_jago');
  });

  test('metode pembayaran dicocokkan dengan nama akun, dua arah', () => {
    expect(resolveCategoryAndAccount({ ...base, paymentMethod: 'gopay' }, categories, accounts).matchedAccId).toBe('acc_gopay');
    expect(resolveCategoryAndAccount({ ...base, paymentMethod: 'Bayar pakai Tunai' }, categories, accounts).matchedAccId).toBe('acc_cash');
  });

  test('kategori dan akun arsip tidak pernah jadi pilihan default', () => {
    const r = resolveCategoryAndAccount(base, [cat('cat_old', 'Lama', { isArchived: true }), ...categories.slice(1)], [accounts[4]!, ...accounts.slice(0, 2)]);
    expect(r.matchedCatId).toBe('cat_food');
    expect(r.matchedAccId).toBe('acc_cash');
  });

  test('tanpa data sama sekali menghasilkan string kosong, bukan error', () => {
    expect(resolveCategoryAndAccount(base, [], [])).toEqual({ matchedCatId: '', matchedAccId: '' });
  });
});

const form = {
  type: 'expense' as const,
  amount: 25000,
  accountId: 'acc_cash',
  toAccountId: '',
  categoryId: 'cat_food',
  date: 1_700_000_000_000,
  note: 'Makan siang',
};

describe('buildTransactionPayload', () => {
  test('pengeluaran dan pemasukan memakai accountId + categoryId', () => {
    const r = buildTransactionPayload(form);
    expect(r).toEqual({
      ok: true,
      payload: expect.objectContaining({ type: 'expense', amount: 25000, accountId: 'acc_cash', categoryId: 'cat_food' }),
    });
    expect(buildTransactionPayload({ ...form, type: 'income' })).toMatchObject({ ok: true, payload: { type: 'income' } });
  });

  test('transfer memakai fromAccountId + toAccountId dan tanpa kategori', () => {
    const r = buildTransactionPayload({ ...form, type: 'transfer', categoryId: '', toAccountId: 'acc_bank' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload).toMatchObject({ type: 'transfer', fromAccountId: 'acc_cash', toAccountId: 'acc_bank' });
      expect('categoryId' in r.payload).toBe(false);
    }
  });

  test.each([
    ['nominal 0', { amount: 0 }, 'Masukkan nominal yang valid'],
    ['nominal negatif', { amount: -5 }, 'Masukkan nominal yang valid'],
    ['nominal pecahan', { amount: 10.5 }, 'Masukkan nominal yang valid'],
    ['nominal NaN', { amount: Number.NaN }, 'Masukkan nominal yang valid'],
    ['akun kosong', { accountId: '' }, 'Pilih akun transaksi'],
    ['kategori kosong', { categoryId: '' }, 'Pilih kategori transaksi'],
    ['transfer tanpa tujuan', { type: 'transfer' as const, toAccountId: '' }, 'Pilih akun tujuan transfer yang berbeda'],
    ['transfer ke akun yang sama', { type: 'transfer' as const, toAccountId: 'acc_cash' }, 'Pilih akun tujuan transfer yang berbeda'],
  ])('menolak %s', (_label, patch, error) => {
    expect(buildTransactionPayload({ ...form, ...patch })).toEqual({ ok: false, error });
  });

  test('transfer tidak butuh kategori', () => {
    expect(buildTransactionPayload({ ...form, type: 'transfer', categoryId: '', toAccountId: 'acc_bank' }).ok).toBe(true);
  });
});

const creator: Creator = { uid: 'u1', name: 'Saya' };
const existing = {
  id: 'tx_old',
  type: 'expense',
  amount: 1000,
  accountId: 'acc_cash',
  categoryId: 'cat_food',
  date: 1,
  note: '',
  referenceKey: 'shopee#1',
  items: [{ name: 'Kopi', qty: 1 }],
  createdBy: { uid: 'u2', name: 'Pasangan' },
  createdAt: 1,
  updatedAt: 1,
} as Transaction;

describe('buildSubmitPayload', () => {
  test('catatan dirapikan dan metadata diambil dari form saat membuat baru', () => {
    const r = buildSubmitPayload({ ...form, note: '  Kopi  ', items: [], referenceKey: undefined, createdBy: creator });
    expect(r).toMatchObject({ ok: true, payload: { note: 'Kopi', createdBy: creator } });
  });

  test('mengedit mempertahankan pembuat, referensi, dan item transaksi lama', () => {
    const r = buildSubmitPayload({ ...form, items: [], referenceKey: null, createdBy: creator, initialTx: existing });
    expect(r).toMatchObject({
      ok: true,
      payload: { referenceKey: 'shopee#1', items: existing.items, createdBy: { uid: 'u2', name: 'Pasangan' } },
    });
  });

  test('item dan referensi baru dari form menggantikan yang lama', () => {
    const items = [{ name: 'Teh', qty: 2 }];
    const r = buildSubmitPayload({ ...form, items, referenceKey: 'tiktok#9', createdBy: creator, initialTx: existing });
    expect(r).toMatchObject({ ok: true, payload: { referenceKey: 'tiktok#9', items } });
  });
});

describe('buildQuickSavePayload', () => {
  test('hasil OCR diutamakan atas isian form', () => {
    const r = buildQuickSavePayload({
      ...form,
      ocr: { referenceKey: 'gofood#1', items: [{ name: 'Nasi', qty: 1 }] },
      items: [{ name: 'Lain', qty: 1 }],
      referenceKey: 'form#1',
      createdBy: creator,
    });
    expect(r).toMatchObject({ ok: true, payload: { referenceKey: 'gofood#1', items: [{ name: 'Nasi', qty: 1 }], createdBy: creator } });
  });

  test('tanpa referensi OCR memakai referensi form; catatan tidak dirapikan', () => {
    const r = buildQuickSavePayload({
      ...form,
      note: ' Struk ',
      ocr: { referenceKey: null, items: undefined as never },
      items: [{ name: 'Lain', qty: 1 }],
      referenceKey: 'form#1',
    });
    expect(r).toMatchObject({ ok: true, payload: { referenceKey: 'form#1', note: ' Struk ', items: [{ name: 'Lain', qty: 1 }] } });
  });

  test('transfer ke akun yang sama ditolak dengan pesan yang jelas', () => {
    const r = buildQuickSavePayload({
      ...form,
      type: 'transfer',
      toAccountId: 'acc_cash',
      ocr: { referenceKey: null, items: undefined as never },
      items: [],
      referenceKey: null,
    });
    expect(r).toEqual({ ok: false, error: 'Pilih akun tujuan transfer yang berbeda' });
  });
});

describe('payload lolos validasi service', () => {
  // Service menjalankan transactionSchema.parse + omitUndefinedDeep sebelum menulis ke Firestore, yang menolak undefined.
  // Test e2e (Gate 18) membuktikan hal yang sama terhadap Firestore sungguhan.
  const through = (payload: unknown) =>
    omitUndefinedDeep(transactionSchema.parse({ ...(payload as object), id: 'tx_new', createdAt: 1, updatedAt: 1 }));
  const hasUndefined = (obj: object) => Object.values(obj).some((v) => v === undefined);

  test.each([
    ['pengeluaran minimal', { ...form }],
    ['pemasukan', { ...form, type: 'income' as const }],
    ['transfer', { ...form, type: 'transfer' as const, categoryId: '', toAccountId: 'acc_bank' }],
  ])('%s tanpa metadata opsional', (_label, input) => {
    const built = buildSubmitPayload({ ...input, items: [], referenceKey: undefined });
    expect(built.ok).toBe(true);
    if (built.ok) expect(hasUndefined(through(built.payload))).toBe(false);
  });

  test('pengeluaran lengkap dengan item, referensi, dan pembuat', () => {
    const built = buildSubmitPayload({
      ...form,
      items: [{ name: 'Kopi', qty: 2, price: 10000, subtotal: 20000 }],
      referenceKey: 'gofood#1',
      createdBy: creator,
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      const saved = through(built.payload);
      expect(hasUndefined(saved)).toBe(false);
      expect(saved).toMatchObject({ referenceKey: 'gofood#1', createdBy: creator });
    }
  });

  test('simpan cepat dari OCR (referensi null) tetap valid', () => {
    const built = buildQuickSavePayload({
      ...form,
      ocr: { referenceKey: null, items: [] },
      items: [],
      referenceKey: null,
    });
    expect(built.ok).toBe(true);
    if (built.ok) expect(hasUndefined(through(built.payload))).toBe(false);
  });
});

describe('buildBatchPayloads', () => {
  const item = (id: string, patch: Partial<BatchReviewItem> = {}): BatchReviewItem => ({
    id,
    previewUrl: '',
    result: { referenceKey: `ref#${id}`, items: [] } as unknown as BatchReviewItem['result'],
    nominal: 10000,
    nominalInput: '10.000',
    categoryId: 'cat_food',
    accountId: 'acc_cash',
    merchant: '  Warung  ',
    date: '2026-11-05',
    isExcluded: false,
    ...patch,
  });

  test('melewati item yang dikecualikan atau bernominal 0', () => {
    const out = buildBatchPayloads([item('a'), item('b', { isExcluded: true }), item('c', { nominal: 0 })], creator, 5);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'expense', amount: 10000, note: 'Warung', referenceKey: 'ref#a', createdBy: creator });
  });

  test('catatan kosong jadi "Struk Belanja"; tanggal tidak valid memakai waktu sekarang', () => {
    const out = buildBatchPayloads([item('a', { merchant: '   ', date: 'bukan-tanggal' })], undefined, 777);
    expect(out[0]).toMatchObject({ note: 'Struk Belanja', date: 777 });
  });

  test('tanggal valid dipakai apa adanya', () => {
    const out = buildBatchPayloads([item('a')], undefined, 5);
    expect(out[0]?.date).toBe(new Date('2026-11-05').getTime());
  });
});
