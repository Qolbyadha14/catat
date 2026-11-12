/**
 * Mencari (dan opsional menghapus) selector di src/styles/components.css yang kelasnya tidak
 * dirujuk di mana pun di src/ atau index.html.
 *
 *   node scripts/prune-unused-css.mjs            laporan saja
 *   node scripts/prune-unused-css.mjs --write    tulis hasil pangkas
 *
 * Aturan konservatif (lebih baik menyisakan CSS mati daripada menghapus yang dipakai):
 * - Sebuah kelas dianggap dipakai bila namanya muncul sebagai token di file sumber, atau cocok dengan
 *   awalan/akhiran dinamis seperti `account-pill-${kind}` dan `${x}-suffix`.
 * - Selector dengan :not() / :is() / :where() / :has() tidak pernah dihapus.
 * - @keyframes dihapus hanya bila tidak ada deklarasi animation yang menyebut namanya.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

const ROOT = new URL('..', import.meta.url).pathname;
const CSS_FILE = join(ROOT, 'src/styles/components.css');
const write = process.argv.includes('--write');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// --- 1. Kumpulkan token yang dipakai di sumber ---
const sourceFiles = [
  ...walk(join(ROOT, 'src')).filter((f) => /\.(tsx?|jsx?)$/.test(f) && !/\.test\.tsx?$/.test(f)),
  join(ROOT, 'index.html'),
];
const tokens = new Set();
const prefixes = new Set();
const suffixes = new Set();
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  for (const t of text.match(/[A-Za-z0-9_-]+/g) ?? []) tokens.add(t);
  for (const m of text.matchAll(/([A-Za-z0-9_-]+-)\$\{/g)) prefixes.add(m[1]);
  for (const m of text.matchAll(/\$\{[^}]*\}(-[A-Za-z0-9_-]+)/g)) suffixes.add(m[1]);
}

const dynamicHits = new Set();
const isUsed = (cls) => {
  if (tokens.has(cls)) return true;
  for (const p of prefixes) if (cls.startsWith(p)) return dynamicHits.add(cls), true;
  for (const s of suffixes) if (cls.endsWith(s)) return dynamicHits.add(cls), true;
  return false;
};

// --- 2. Pangkas selector ---
const css = readFileSync(CSS_FILE, 'utf8');
const root = postcss.parse(css);
const removedClasses = new Set();
let removedSelectors = 0;
let removedRules = 0;

const hasComplexPseudo = (sel) => /:(not|is|where|has)\(/.test(sel);
const classesOf = (sel) => [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);

root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
  const keep = [];
  for (const sel of rule.selectors) {
    const classes = hasComplexPseudo(sel) ? [] : classesOf(sel);
    const dead = classes.filter((c) => !isUsed(c));
    if (dead.length === 0) keep.push(sel);
    else {
      removedSelectors++;
      dead.forEach((c) => removedClasses.add(c));
    }
  }
  if (keep.length === 0) {
    removedRules++;
    rule.remove();
  } else if (keep.length !== rule.selectors.length) {
    rule.selectors = keep;
  }
});

// Buang @media/@supports yang menjadi kosong
root.walkAtRules((at) => {
  if (/^(media|supports|container|layer)$/i.test(at.name) && at.nodes && at.nodes.every((n) => n.type === 'comment')) {
    at.remove();
  }
});

// Buang @keyframes yang tidak dirujuk (ulangi sampai stabil karena animation bisa berada di rule yang sudah dihapus)
const removedKeyframes = [];
const referencedAnimations = () => {
  const names = new Set();
  root.walkDecls(/^(animation|animation-name)$/, (d) => d.value.split(/[\s,]+/).forEach((v) => names.add(v)));
  return names;
};
const refs = referencedAnimations();
root.walkAtRules(/keyframes$/i, (at) => {
  if (!refs.has(at.params) && !tokens.has(at.params)) {
    removedKeyframes.push(at.params);
    at.remove();
  }
});

// Rapikan baris kosong berlebih bekas rule yang dihapus
let output = root.toString().replace(/\n{3,}/g, '\n\n');

// --- 3. Laporan ---
const before = css.length;
console.log(`components.css: ${css.split('\n').length} -> ${output.split('\n').length} baris, ${before} -> ${output.length} byte`);
console.log(`selector dihapus: ${removedSelectors}, rule dihapus: ${removedRules}, keyframes dihapus: ${removedKeyframes.length}`);
console.log(`kelas dihapus (${removedClasses.size}): ${[...removedClasses].sort().join(' ')}`);
if (removedKeyframes.length) console.log(`keyframes dihapus: ${removedKeyframes.join(' ')}`);
if (dynamicHits.size) console.log(`dipertahankan karena pola dinamis (${dynamicHits.size}): ${[...dynamicHits].sort().join(' ')}`);
console.log(`awalan dinamis di sumber: ${[...prefixes].join(' ') || '-'} | akhiran: ${[...suffixes].join(' ') || '-'}`);

if (write) {
  writeFileSync(CSS_FILE, output);
  console.log('ditulis ke src/styles/components.css');
} else {
  console.log('(mode laporan; tambahkan --write untuk menulis)');
}
