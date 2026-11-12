import { describe, expect, test } from 'bun:test';
import type { Account, Category, Creator, Transaction } from '../../lib/schemas';
import { BACKUP_VERSION, backupFileName, buildBackup, parseBackup, type ParsedBackup } from './backupFormat';
import { aggregateBalanceDeltas, chunkTransactionsForWrite, isPlanEmpty, planRestore, type ExistingIds } from './restorePlan';

const base = { createdAt: 1, updatedAt: 1, note: '' };
const acc = (id: string, balance: number, createdAt = 1): Account => ({
  id,
  name: id,
  kind: 'asset',
  balance,
  isArchived: false,
  createdAt,
});
const cat = (id: string, type: 'income' | 'expense' = 'expense'): Category => ({
  id,
  name: id,
  type,
  isArchived: false,
  createdAt: 1,
});
const expense = (id: string, amount: number, date: number, accountId = 'cash', createdBy?: Creator): Transaction =>
  ({ ...base, id, type: 'expense', amount, date, accountId, categoryId: 'food', createdBy }) as Transaction;
const income = (id: string, amount: number, date: number, accountId = 'cash'): Transaction =>
  ({ ...base, id, type: 'income', amount, date, accountId, categoryId: 'salary' }) as Transaction;
const transfer = (id: string, amount: number, date: number, fromAccountId: string, toAccountId: string): Transaction =>
  ({ ...base, id, type: 'transfer', amount, date, fromAccountId, toAccountId }) as Transaction;

const me: Creator = { uid: 'me', name: 'Saya' };
const none: ExistingIds = { accountIds: new Set(), categoryIds: new Set(), transactionIds: new Set() };
const parsed = (over: Partial<ParsedBackup> = {}): ParsedBackup => ({
  exportedAt: null,
  scope: 'personal',
  scopeName: '',
  accounts: [acc('cash', 1000), acc('bca', 5000)],
  categories: [cat('food'), cat('salary', 'income')],
  transactions: [],
  invalid: { accounts: 0, categories: 0, transactions: 0 },
  ...over,
});

describe('buildBackup', () => {
  test('mengurutkan isi dan mengisi metadata', () => {
    const b = buildBackup(
      {
        scope: 'family',
        scopeName: 'Keluarga',
        accounts: [acc('b', 1, 2), acc('a', 1, 1)],
        categories: [],
        transactions: [expense('t2', 1, 20), expense('t1', 1, 10)],
      },
      new Date('2026-11-12T00:00:00Z')
    );
    expect(b.app).toBe('catat');
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.exportedAt).toBe('2026-11-12T00:00:00.000Z');
    expect(b.accounts.map((a) => a.id)).toEqual(['a', 'b']);
    expect(b.transactions.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  test('nama file memakai tanggal lokal', () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe('catat-backup-2026-11-05.json');
  });
});

describe('parseBackup', () => {
  const valid = () =>
    JSON.stringify(
      buildBackup({
        scope: 'personal',
        scopeName: 'Pribadi',
        accounts: [acc('cash', 1000)],
        categories: [cat('food')],
        transactions: [expense('t1', 500, 10)],
      })
    );

  test('round trip backup valid', () => {
    const r = parseBackup(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.transactions).toHaveLength(1);
      expect(r.backup.invalid).toEqual({ accounts: 0, categories: 0, transactions: 0 });
    }
  });

  test('menolak JSON rusak, bukan Catat, dan versi lebih baru', () => {
    expect(parseBackup('{bukan json')).toEqual({ ok: false, error: 'File bukan JSON yang valid.' });
    expect(parseBackup('{"app":"lain"}')).toEqual({ ok: false, error: 'Ini bukan file backup Catat.' });
    const newer = parseBackup(JSON.stringify({ app: 'catat', version: BACKUP_VERSION + 1, accounts: [], categories: [], transactions: [] }));
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.error).toContain('lebih baru');
  });

  test('item rusak dilewati dan dihitung', () => {
    const obj = JSON.parse(valid());
    obj.transactions.push({ id: 'x', type: 'expense', amount: -5 });
    obj.accounts.push('sampah');
    const r = parseBackup(JSON.stringify(obj));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.transactions).toHaveLength(1);
      expect(r.backup.invalid).toEqual({ accounts: 1, categories: 0, transactions: 1 });
    }
  });
});

describe('aggregateBalanceDeltas', () => {
  test('menjumlah per akun dan membuang total nol', () => {
    const d = aggregateBalanceDeltas([
      income('i', 100, 1),
      expense('e', 30, 2),
      transfer('t', 50, 3, 'cash', 'bca'),
      expense('z1', 10, 4, 'bca'),
      income('z2', 10, 5, 'zero'),
      expense('z3', 10, 6, 'zero'),
    ]);
    expect(d.get('cash')).toBe(20);
    expect(d.get('bca')).toBe(40);
    expect(d.has('zero')).toBe(false);
  });
});

describe('chunkTransactionsForWrite', () => {
  test('tiap kelompok tidak melebihi batas operasi dan urutan terjaga', () => {
    const txs = Array.from({ length: 25 }, (_, i) => expense(`t${i}`, 1, i));
    const chunks = chunkTransactionsForWrite(txs, 10);
    expect(chunks.flat().map((t) => t.id)).toEqual(txs.map((t) => t.id));
    for (const chunk of chunks) {
      const accounts = new Set(chunk.map((t) => (t as { accountId: string }).accountId));
      expect(chunk.length + accounts.size).toBeLessThanOrEqual(10);
    }
    expect(chunks).toHaveLength(3);
  });

  test('transfer dihitung dua akun dan daftar kosong menghasilkan nol kelompok', () => {
    expect(chunkTransactionsForWrite([], 10)).toEqual([]);
    const chunks = chunkTransactionsForWrite([transfer('a', 1, 1, 'cash', 'bca'), transfer('b', 1, 2, 'cash', 'bca')], 3);
    expect(chunks.map((c) => c.length)).toEqual([1, 1]);
  });
});

describe('planRestore', () => {
  test('akun baru mendapat saldo awal sehingga saldo akhir sama dengan backup', () => {
    const txs = [income('i', 300, 1), expense('e', 100, 2)];
    const plan = planRestore(parsed({ accounts: [acc('cash', 1000)], transactions: txs }), none, me);
    expect(plan.accountsToCreate[0]!.balance).toBe(1000 - 200);
    const final = plan.accountsToCreate[0]!.balance + (aggregateBalanceDeltas(plan.transactionsToCreate).get('cash') ?? 0);
    expect(final).toBe(1000);
  });

  test('akun yang sudah ada tidak dibuat ulang dan transaksi yang sudah ada dilewati', () => {
    const existing: ExistingIds = {
      accountIds: new Set(['cash']),
      categoryIds: new Set(['food', 'salary']),
      transactionIds: new Set(['e1']),
    };
    const plan = planRestore(
      parsed({ transactions: [expense('e1', 10, 1), expense('e2', 20, 2)] }),
      existing,
      me
    );
    expect(plan.accountsToCreate.map((a) => a.id)).toEqual(['bca']);
    expect(plan.categoriesToCreate).toHaveLength(0);
    expect(plan.transactionsToCreate.map((t) => t.id)).toEqual(['e2']);
    expect(plan.skipped.existing).toBe(1);
  });

  test('id ganda di file hanya diproses sekali', () => {
    const plan = planRestore(parsed({ transactions: [expense('d', 10, 1), expense('d', 10, 1)] }), none, me);
    expect(plan.transactionsToCreate).toHaveLength(1);
    expect(plan.skipped.existing).toBe(1);
  });

  test('transaksi dengan akun atau kategori tidak dikenal dilewati', () => {
    const plan = planRestore(
      parsed({
        transactions: [
          expense('ok', 10, 1),
          expense('noacc', 10, 2, 'hilang'),
          { ...expense('nocat', 10, 3), categoryId: 'hilang' } as Transaction,
          transfer('notf', 10, 4, 'cash', 'hilang'),
        ],
      }),
      none,
      me
    );
    expect(plan.transactionsToCreate.map((t) => t.id)).toEqual(['ok']);
    expect(plan.skipped.missingRefs).toBe(3);
  });

  test('transaksi anggota lain dicatat ulang atas nama pemulih', () => {
    const other: Creator = { uid: 'other', name: 'Budi', photoURL: 'https://x.test/a.png' };
    const plan = planRestore(
      parsed({ transactions: [expense('a', 10, 1, 'cash', other), expense('b', 10, 2, 'cash', me), expense('c', 10, 3)] }),
      none,
      me
    );
    expect(plan.reattributed).toBe(1);
    expect(plan.transactionsToCreate[0]!.createdBy).toEqual({ uid: 'me', name: 'Saya' });
    expect(plan.transactionsToCreate[1]!.createdBy).toEqual(me);
    expect(plan.transactionsToCreate[2]!.createdBy).toBeUndefined();
  });

  test('transaksi diurutkan dari yang terlama dan item rusak dihitung', () => {
    const plan = planRestore(
      parsed({ transactions: [expense('late', 1, 20), expense('early', 1, 10)], invalid: { accounts: 1, categories: 2, transactions: 3 } }),
      none,
      me
    );
    expect(plan.transactionsToCreate.map((t) => t.id)).toEqual(['early', 'late']);
    expect(plan.skipped.invalid).toBe(6);
  });

  test('rencana kosong terdeteksi', () => {
    const existing: ExistingIds = {
      accountIds: new Set(['cash', 'bca']),
      categoryIds: new Set(['food', 'salary']),
      transactionIds: new Set(['e1']),
    };
    const plan = planRestore(parsed({ transactions: [expense('e1', 10, 1)] }), existing, me);
    expect(isPlanEmpty(plan)).toBe(true);
  });
});
