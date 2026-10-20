import type { Transaction } from '../../lib/schemas';

export function generateCsvContent(
  transactions: Transaction[],
  accountMap: Map<string, { name: string }>,
  categoryMap: Map<string, { name: string }>
): string {
  const headers = ['Tanggal', 'Tipe', 'Kategori', 'Akun', 'Nominal', 'Catatan'];

  const rows = transactions.map((t) => {
    let catName = 'Transfer';
    let accName = '';

    if (t.type === 'transfer') {
      const from = accountMap.get(t.fromAccountId)?.name || 'Akun';
      const to = accountMap.get(t.toAccountId)?.name || 'Akun';
      accName = `${from} -> ${to}`;
    } else {
      catName = categoryMap.get(t.categoryId)?.name || 'Lainnya';
      accName = accountMap.get(t.accountId)?.name || 'Akun';
    }

    const noteEscaped = `"${(t.note || '').replace(/"/g, '""')}"`;

    return [
      t.date,
      t.type,
      catName,
      accName,
      t.amount,
      noteEscaped,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
