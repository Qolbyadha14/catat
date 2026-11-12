import { getCategoryTone, getCategoryToneName } from './categoryTone';
import { test } from 'bun:test';

test('lib/categoryTone.test.ts', async () => {
function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// 1. Kategori bawaan tetap memakai warna yang sudah dikenal pengguna
assert(getCategoryToneName('cat_1', 'Makan & Minum') === 'orange', 'food is orange');
assert(getCategoryToneName('cat_2', 'Gaji') === 'emerald', 'salary is emerald');
assert(getCategoryToneName('cat_3', 'belanja bulanan') === 'purple', 'keyword match is case-insensitive');
assert(getCategoryToneName('cat_4', 'Tagihan Listrik') === 'blue', 'bills are blue');

// 2. Kategori buatan pengguna stabil per ID dan tidak semuanya biru
const custom = ['cat_hobi', 'cat_anak', 'cat_hewan', 'cat_zakat', 'cat_liburan', 'cat_pendidikan'];
const tones = custom.map((id) => getCategoryToneName(id, 'Kustom'));
assert(new Set(tones).size > 1, 'custom categories get varied tones');
assert(getCategoryToneName('cat_hobi', 'Kustom') === getCategoryToneName('cat_hobi', 'Kustom'), 'stable per id');

// 3. Setiap nada punya varian dark
for (const id of custom) {
  const cls = getCategoryTone(id, 'Kustom');
  assert(cls.includes('dark:bg-') && cls.includes('dark:text-'), `tone for ${id} has dark variants`);
}

console.log('categoryTone tests pass');
});
