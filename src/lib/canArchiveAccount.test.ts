import { describe, it, expect } from 'bun:test';
import { canArchiveAccount } from './canArchiveAccount';

describe('canArchiveAccount pure guard', () => {
  const accCash = { id: 'acc_cash', balance: 0 };
  const accBank = { id: 'acc_bank', balance: 0 };

  it('Tolak arsip jika saldo !== 0', () => {
    const accWithBalance = { id: 'acc_cash', balance: 50_000 };
    const res = canArchiveAccount(accWithBalance, [accWithBalance, accBank]);

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('Pindahkan saldo dulu sebelum arsip');
  });

  it('Tolak arsip jika saldo negatif !== 0', () => {
    const accNegative = { id: 'acc_cash', balance: -10_000 };
    const res = canArchiveAccount(accNegative, [accNegative, accBank]);

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('Pindahkan saldo dulu sebelum arsip');
  });

  it('Tolak arsip jika akun aktif terakhir (activeAccounts length === 1)', () => {
    const res = canArchiveAccount(accCash, [accCash]);

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('Akun aktif terakhir tidak bisa diarsip');
  });

  it('Izinkan arsip jika saldo 0 dan masih ada akun aktif lain (happy path)', () => {
    const res = canArchiveAccount(accCash, [accCash, accBank]);

    expect(res.allowed).toBe(true);
    expect(res.reason).toBeUndefined();
  });
});
