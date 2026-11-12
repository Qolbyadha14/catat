import { describe, expect, test } from 'bun:test';
import type { Transaction } from './schemas';
import { formatDate } from './formatters';
import { searchTransactions } from './transactionSearch';

const lookups = {
  accountNames: new Map([
    ['acc_cash', 'Dompet Tunai'],
    ['acc_bca', 'Bank BCA'],
  ]),
  categoryNames: new Map([
    ['cat_food', 'Makan & Minum'],
    ['cat_salary', 'Gaji'],
  ]),
};

const base = { createdAt: 1, updatedAt: 1, note: '' };
const txs = [
  { ...base, id: 'a', type: 'expense', amount: 25000, accountId: 'acc_cash', categoryId: 'cat_food', date: new Date(2026, 10, 3).getTime(), note: 'Bakso malam' },
  { ...base, id: 'b', type: 'income', amount: 8500000, accountId: 'acc_bca', categoryId: 'cat_salary', date: new Date(2026, 8, 25).getTime(), note: '' },
  { ...base, id: 'c', type: 'transfer', amount: 150000, fromAccountId: 'acc_bca', toAccountId: 'acc_cash', date: new Date(2026, 9, 10).getTime(), note: 'Tarik tunai' },
] as Transaction[];

const ids = (query: string) => searchTransactions(txs, query, lookups).map((t) => t.id);

describe('searchTransactions', () => {
  test('query kosong mengembalikan semua transaksi tanpa mengubah array asli', () => {
    const out = searchTransactions(txs, '   ', lookups);
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(out).not.toBe(txs);
  });

  test('mencari di catatan tanpa membedakan huruf besar/kecil', () => {
    expect(ids('BAKSO')).toEqual(['a']);
  });

  test('mencari nama kategori dan nama akun', () => {
    expect(ids('gaji')).toEqual(['b']);
    expect(ids('makan')).toEqual(['a']);
    expect(ids('dompet')).toEqual(['a', 'c']);
  });

  test('transfer cocok lewat akun asal maupun tujuan', () => {
    expect(ids('bank bca')).toEqual(['b', 'c']);
    expect(ids('tunai')).toEqual(['a', 'c']);
  });

  test('nominal cocok dengan angka mentah dan dengan pemisah ribuan', () => {
    expect(ids('25000')).toEqual(['a']);
    expect(ids('25.000')).toEqual(['a']);
    expect(ids('25,000')).toEqual(['a']);
    expect(ids('8.500.000')).toEqual(['b']);
  });

  test('angka dengan pemisah ribuan dicocokkan persis, bukan sebagai bagian angka lain', () => {
    const withBig = [
      ...txs,
      { ...base, id: 'd', type: 'expense', amount: 1500000, accountId: 'acc_cash', categoryId: 'cat_food', date: 1 },
      { ...base, id: 'e', type: 'expense', amount: 500000, accountId: 'acc_cash', categoryId: 'cat_food', date: 1 },
    ] as Transaction[];
    const found = (q: string) => searchTransactions(withBig, q, lookups).map((t) => t.id);
    expect(found('500.000')).toEqual(['e']);
    expect(found('1.500.000')).toEqual(['d']);
  });

  test('angka polos tanpa pemisah tetap cocok sebagian saat masih diketik', () => {
    const withBig = [...txs, { ...base, id: 'd', type: 'expense', amount: 1500000, accountId: 'acc_cash', categoryId: 'cat_food', date: 1 }] as Transaction[];
    // "1500" ada di 150000 dan 1500000, tidak di nominal lain
    expect(searchTransactions(withBig, '1500', lookups).map((t) => t.id)).toEqual(['c', 'd']);
    expect(searchTransactions(withBig, '85', lookups).map((t) => t.id)).toEqual(['b']);
  });

  test('tanggal cocok dengan teks tanggal yang tampil di daftar', () => {
    const shown = formatDate(txs[2]!.date);
    expect(ids(shown.slice(0, 6))).toContain('c');
    expect(ids(shown)).toEqual(['c']);
  });

  test('tidak ada yang cocok menghasilkan array kosong', () => {
    expect(ids('tidak-ada-yang-begini')).toEqual([]);
  });

  test('ID akun/kategori yang tidak dikenal tidak membuat error', () => {
    const orphan = [{ ...txs[0]!, accountId: 'hilang', categoryId: 'hilang' }] as Transaction[];
    expect(searchTransactions(orphan, 'bakso', lookups)).toHaveLength(1);
    expect(searchTransactions(orphan, 'dompet', lookups)).toHaveLength(0);
  });
});
