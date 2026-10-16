import type { Account } from './schemas';

export interface CanArchiveResult {
  allowed: boolean;
  reason?: string;
}

export function canArchiveAccount(
  account: Pick<Account, 'id' | 'balance'>,
  activeAccounts: Pick<Account, 'id'>[]
): CanArchiveResult {
  if (account.balance !== 0) {
    return { allowed: false, reason: 'Pindahkan saldo dulu sebelum arsip' };
  }

  const remainingActive = activeAccounts.filter((a) => a.id !== account.id);
  if (remainingActive.length === 0) {
    return { allowed: false, reason: 'Akun aktif terakhir tidak bisa diarsip' };
  }

  return { allowed: true };
}
