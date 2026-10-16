import type { Transaction } from './schemas';

export type AccountLookup =
  | Map<string, { name: string; isArchived?: boolean }>
  | Array<{ id: string; name: string; isArchived?: boolean }>;

export type CategoryLookup =
  | Map<string, { name: string; icon?: string; isArchived?: boolean }>
  | Array<{ id: string; name: string; icon?: string; isArchived?: boolean }>;

export function escapeCsvField(val: string | number, isText = false): string {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  let str = String(val ?? '');
  if (isText && /^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsCSV(
  transactions: Transaction[],
  accounts: AccountLookup,
  categories: CategoryLookup
): string {
  const accMap =
    accounts instanceof Map
      ? accounts
      : new Map(accounts.map((a) => [a.id, a]));

  const catMap =
    categories instanceof Map
      ? categories
      : new Map(categories.map((c) => [c.id, c]));

  const header = ['tanggal', 'tipe', 'jumlah', 'akun', 'kategori', 'catatan'].join(',');

  const rows = transactions.map((tx) => {
    // 1. Tanggal (YYYY-MM-DD local)
    const d = new Date(tx.date);
    const dateStr = !isNaN(d.getTime())
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : '';

    // 2. Tipe
    const tipeStr = tx.type;

    // 3. Jumlah (raw number, not text-prefixed)
    const amountVal = tx.amount;

    // 4. Akun & 5. Kategori
    let akunStr = '';
    let kategoriStr = '';

    if (tx.type === 'transfer') {
      const fromAcc = accMap.get(tx.fromAccountId);
      const toAcc = accMap.get(tx.toAccountId);
      const fromName = fromAcc
        ? `${fromAcc.name}${fromAcc.isArchived ? ' (Arsip)' : ''}`
        : tx.fromAccountId;
      const toName = toAcc
        ? `${toAcc.name}${toAcc.isArchived ? ' (Arsip)' : ''}`
        : tx.toAccountId;
      akunStr = `${fromName} → ${toName}`;
      kategoriStr = 'Transfer';
    } else {
      const acc = accMap.get(tx.accountId);
      akunStr = acc
        ? `${acc.name}${acc.isArchived ? ' (Arsip)' : ''}`
        : tx.accountId;

      const cat = catMap.get(tx.categoryId);
      kategoriStr = cat
        ? `${cat.name}${cat.isArchived ? ' (Arsip)' : ''}`
        : (tx.categoryId || '');
    }

    // 6. Catatan
    const catatanStr = tx.note || '';

    return [
      escapeCsvField(dateStr, false),
      escapeCsvField(tipeStr, false),
      escapeCsvField(amountVal, false),
      escapeCsvField(akunStr, true),
      escapeCsvField(kategoriStr, true),
      escapeCsvField(catatanStr, true),
    ].join(',');
  });

  return '\uFEFF' + [header, ...rows].join('\r\n') + '\r\n';
}

export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
