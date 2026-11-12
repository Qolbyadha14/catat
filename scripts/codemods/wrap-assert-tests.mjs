/**
 * Codemod satu kali: membungkus test assert-style di src/ ke dalam test() dari bun:test,
 * agar `bun test` melaporkan pass/fail per file (sebelumnya "Ran 0 tests").
 *
 * Pemakaian: node scripts/codemods/wrap-assert-tests.mjs [--check]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = new URL('../../src/', import.meta.url).pathname;
const checkOnly = process.argv.includes('--check');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT).filter((f) => /\.test\.tsx?$/.test(f));
let changed = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (text.includes("from 'bun:test'")) continue;

  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const imports = source.statements.filter(ts.isImportDeclaration);
  const splitAt = imports.length ? imports[imports.length - 1].getEnd() : 0;

  const head = text.slice(0, splitAt).trimEnd();
  // Fungsi helper yang di-export dari file test tidak dipakai di tempat lain; di dalam blok tidak boleh export
  const body = text
    .slice(splitAt)
    .replace(/^export (function|const|async function) /gm, '$1 ')
    .trim();

  const name = relative(ROOT, file);
  const output =
    `${head ? `${head}\n` : ''}import { test } from 'bun:test';\n\n` +
    `test('${name}', async () => {\n${body}\n});\n`;

  changed++;
  if (!checkOnly) writeFileSync(file, output);
  console.log(`${checkOnly ? 'would wrap' : 'wrapped'}: ${name}`);
}

console.log(`${changed} file(s)`);
