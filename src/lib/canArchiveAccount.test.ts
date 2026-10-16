import { canArchiveAccount } from './canArchiveAccount';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const accCash = { id: 'acc_cash', balance: 0 };
const accBank = { id: 'acc_bank', balance: 0 };

// 1. Tolak arsip jika saldo !== 0
{
  const accWithBalance = { id: 'acc_cash', balance: 50_000 };
  const res = canArchiveAccount(accWithBalance, [accWithBalance, accBank]);
  assert(res.allowed === false, 'Non-zero balance must be rejected');
  assert(res.reason === 'Pindahkan saldo dulu sebelum arsip', 'Reason must match spec');
}

// 2. Tolak arsip jika saldo negatif !== 0
{
  const accNegative = { id: 'acc_cash', balance: -10_000 };
  const res = canArchiveAccount(accNegative, [accNegative, accBank]);
  assert(res.allowed === false, 'Negative balance must be rejected');
  assert(res.reason === 'Pindahkan saldo dulu sebelum arsip', 'Reason must match spec');
}

// 3. Tolak arsip jika akun aktif terakhir (activeAccounts length === 1)
{
  const res = canArchiveAccount(accCash, [accCash]);
  assert(res.allowed === false, 'Last active account must be rejected');
  assert(res.reason === 'Akun aktif terakhir tidak bisa diarsip', 'Reason must match spec');
}

// 4. Izinkan arsip jika saldo 0 dan masih ada akun aktif lain (happy path)
{
  const res = canArchiveAccount(accCash, [accCash, accBank]);
  assert(res.allowed === true, 'Zero balance with other active accounts must pass');
  assert(res.reason === undefined, 'No reason on success');
}

console.log('canArchiveAccount asserts pass');
