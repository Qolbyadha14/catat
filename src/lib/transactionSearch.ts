import type { Transaction } from './schemas';
import { formatDate } from './formatters';

export interface SearchLookups {
  accountNames: ReadonlyMap<string, string>;
  categoryNames: ReadonlyMap<string, string>;
}

/**
 * Angka dengan pemisah ribuan ("25.000", "25,000", "25 000") dianggap nominal persis: 25000.
 * Mengembalikan null bila query bukan angka berpemisah (angka polos tetap dicocokkan sebagian).
 */
function exactAmountFromFormatted(query: string): number | null {
  if (!/[.,\s]/.test(query)) return null;
  const cleaned = query.replace(/[.,\s]/g, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
}

/**
 * Mencari di catatan, nama kategori, nama akun (termasuk asal/tujuan transfer), nominal, dan tanggal.
 * Query kosong mengembalikan semua transaksi (pemanggil yang membatasi jumlahnya).
 */
export function searchTransactions(
  transactions: readonly Transaction[],
  rawQuery: string,
  { accountNames, categoryNames }: SearchLookups
): Transaction[] {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return [...transactions];
  const exactAmount = exactAmountFromFormatted(q);

  return transactions.filter((tx) => {
    const fields: string[] = [tx.note ?? '', formatDate(tx.date)];
    if (tx.type === 'transfer') {
      fields.push(accountNames.get(tx.fromAccountId) ?? '', accountNames.get(tx.toAccountId) ?? '');
    } else {
      fields.push(categoryNames.get(tx.categoryId) ?? '', accountNames.get(tx.accountId) ?? '');
    }
    if (fields.some((f) => f.toLowerCase().includes(q))) return true;

    // "500.000" berarti Rp 500.000 persis (bukan bagian dari 15.000.000); "500" cocok sebagian (500, 5000, 150000)
    if (exactAmount !== null) return tx.amount === exactAmount;
    return String(tx.amount).includes(q);
  });
}
