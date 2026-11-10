/**
 * Warna latar + teks untuk ikon kategori, lengkap dengan varian dark.
 * Kelas ditulis utuh agar terdeteksi oleh scanner Tailwind.
 */
const TONES = {
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
} as const;

export type CategoryToneName = keyof typeof TONES;

/** Nada untuk transfer antar akun. */
export const TRANSFER_TONE = TONES.cyan;

// Kata kunci untuk kategori bawaan (seedDefaults) dan nama umum
const KEYWORD_TONES: ReadonlyArray<[RegExp, CategoryToneName]> = [
  [/makan|food|minum|kopi|resto/i, 'orange'],
  [/gaji|income|bonus|pendapatan|investasi/i, 'emerald'],
  [/belanja|shop|groceries/i, 'purple'],
  [/transport|kendaraan|bensin|parkir|ojek/i, 'amber'],
  [/tagihan|listrik|air|internet|pulsa/i, 'blue'],
  [/kesehatan|health|obat|dokter/i, 'rose'],
];

// Kategori buatan pengguna mendapat warna stabil dari ID, bukan selalu biru
const FALLBACK_TONES: readonly CategoryToneName[] = ['indigo', 'teal', 'cyan', 'purple', 'amber', 'rose', 'emerald', 'blue'];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getCategoryToneName(categoryId: string | undefined, name: string): CategoryToneName {
  for (const [pattern, tone] of KEYWORD_TONES) {
    if (pattern.test(name)) return tone;
  }
  const key = categoryId || name;
  return FALLBACK_TONES[hashString(key) % FALLBACK_TONES.length] ?? 'blue';
}

export function getCategoryTone(categoryId: string | undefined, name: string): string {
  return TONES[getCategoryToneName(categoryId, name)];
}
