import { z } from 'zod';
import {
  accountSchema,
  parseCategoryDoc,
  transactionSchema,
  type Account,
  type Category,
  type Transaction,
} from '../../lib/schemas';

export const BACKUP_APP = 'catat';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  /** ISO 8601 */
  exportedAt: string;
  scope: 'personal' | 'family';
  /** Nama buku kas saat backup dibuat, hanya untuk ditampilkan. */
  scopeName: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

export function buildBackup(
  input: {
    scope: Backup['scope'];
    scopeName: string;
    accounts: readonly Account[];
    categories: readonly Category[];
    transactions: readonly Transaction[];
  },
  now: Date = new Date()
): Backup {
  // Urutan deterministik agar dua backup dari data yang sama menghasilkan isi yang sama
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    scope: input.scope,
    scopeName: input.scopeName,
    accounts: [...input.accounts].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    categories: [...input.categories].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    transactions: [...input.transactions].sort((a, b) => a.date - b.date || a.id.localeCompare(b.id)),
  };
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `catat-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const envelopeSchema = z.object({
  app: z.literal(BACKUP_APP, { error: 'Ini bukan file backup Catat.' }),
  version: z.number({ error: 'Versi backup tidak terbaca.' }).int().min(1),
  exportedAt: z.string().optional(),
  scope: z.enum(['personal', 'family']).optional(),
  scopeName: z.string().optional(),
  accounts: z.array(z.unknown(), { error: 'Daftar akun tidak ada di file backup.' }),
  categories: z.array(z.unknown(), { error: 'Daftar kategori tidak ada di file backup.' }),
  transactions: z.array(z.unknown(), { error: 'Daftar transaksi tidak ada di file backup.' }),
});

export interface ParsedBackup {
  exportedAt: string | null;
  scope: Backup['scope'] | null;
  scopeName: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  /** Item yang gagal validasi dan tidak ikut diproses. */
  invalid: { accounts: number; categories: number; transactions: number };
}

export type ParseBackupResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string };

/** Membaca teks file backup. Item rusak dilewati dan dihitung, bukan membatalkan seluruh file. */
export function parseBackup(text: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File bukan JSON yang valid.' };
  }

  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) {
    return { ok: false, error: envelope.error.issues[0]?.message ?? 'Format file backup tidak dikenali.' };
  }
  const data = envelope.data;
  if (data.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `File backup versi ${data.version} lebih baru dari yang didukung aplikasi ini (versi ${BACKUP_VERSION}). Perbarui aplikasi lebih dulu.`,
    };
  }

  const collect = <T>(items: unknown[], parse: (item: unknown) => { success: boolean; data?: T }) => {
    const valid: T[] = [];
    let invalid = 0;
    for (const item of items) {
      const parsed = parse(item);
      if (parsed.success && parsed.data !== undefined) valid.push(parsed.data);
      else invalid++;
    }
    return { valid, invalid };
  };

  const accounts = collect<Account>(data.accounts, (i) => accountSchema.safeParse(i));
  const categories = collect<Category>(data.categories, (i) => parseCategoryDoc(i));
  const transactions = collect<Transaction>(data.transactions, (i) => transactionSchema.safeParse(i));

  return {
    ok: true,
    backup: {
      exportedAt: data.exportedAt ?? null,
      scope: data.scope ?? null,
      scopeName: data.scopeName ?? '',
      accounts: accounts.valid,
      categories: categories.valid,
      transactions: transactions.valid,
      invalid: { accounts: accounts.invalid, categories: categories.invalid, transactions: transactions.invalid },
    },
  };
}
