import {
  exportTransactionsCSV,
  escapeCsvField,
} from './exportTransactionsCSV';
import type { Transaction } from './schemas';

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

// 1. escapeCsvField tests
// Number stays numeric raw string, never prefixed with formula quote
assert(escapeCsvField(25000, false) === '25000', 'Positive number should stay unchanged');
assert(escapeCsvField(-50000, false) === '-50000', 'Negative number should not have formula prefix');

// Formula injection on text cols (=, +, -, @)
assert(escapeCsvField('=SUM(A1:A5)', true) === "'=SUM(A1:A5)", 'Equals should be prefixed with single quote');
assert(escapeCsvField('+628123456789', true) === "'+628123456789", 'Plus should be prefixed with single quote');
assert(escapeCsvField('- Beli kopi', true) === "'- Beli kopi", 'Hyphen should be prefixed with single quote');
assert(escapeCsvField('@admin', true) === "'@admin", 'At symbol should be prefixed with single quote');

// RFC 4180 escaping
assert(escapeCsvField('Hello, World', true) === '"Hello, World"', 'Comma requires quotes');
assert(escapeCsvField('Menu "Spesial"', true) === '"Menu ""Spesial"""', 'Quotes require escaping with double quotes');
assert(escapeCsvField('=1+1, test', true) === "\"'=1+1, test\"", 'Formula and comma combinations');

// 2. exportTransactionsCSV tests
const accounts = new Map([
  ['acc_cash', { name: 'Dompet Tunai', isArchived: false }],
  ['acc_bank', { name: 'Bank BCA', isArchived: false }],
  ['acc_old', { name: 'Rekening Lama', isArchived: true }],
]);

const categories = new Map([
  ['cat_food', { name: 'Makanan & Minum', isArchived: false }],
  ['cat_salary', { name: 'Gaji Pokok', isArchived: false }],
  ['cat_old', { name: 'Kategori Kuno', isArchived: true }],
]);

const testDate = new Date(2026, 4, 15, 10, 30).getTime(); // 2026-05-15

const testTransactions: Transaction[] = [
  {
    id: 'tx_1',
    type: 'expense',
    amount: 35000,
    accountId: 'acc_cash',
    categoryId: 'cat_food',
    date: testDate,
    note: 'Nasi padang "rendang", es teh',
    createdAt: testDate,
    updatedAt: testDate,
  },
  {
    id: 'tx_2',
    type: 'income',
    amount: 10000000,
    accountId: 'acc_bank',
    categoryId: 'cat_salary',
    date: testDate,
    note: '=1+1 bonus',
    createdAt: testDate,
    updatedAt: testDate,
  },
  {
    id: 'tx_3',
    type: 'expense',
    amount: 150000,
    accountId: 'acc_old',
    categoryId: 'cat_old',
    date: testDate,
    note: '- Bayar utang lama',
    createdAt: testDate,
    updatedAt: testDate,
  },
  {
    id: 'tx_4',
    type: 'transfer',
    amount: 500000,
    fromAccountId: 'acc_bank',
    toAccountId: 'acc_old',
    date: testDate,
    note: 'Topup ke akun arsip',
    createdAt: testDate,
    updatedAt: testDate,
  },
];

const csvOutput = exportTransactionsCSV(testTransactions, accounts, categories);

// BOM Check
assert(csvOutput.charCodeAt(0) === 0xfeff, 'CSV must start with UTF-8 BOM');

// Header Check
assert(
  csvOutput.startsWith('\uFEFFtanggal,tipe,jumlah,akun,kategori,catatan'),
  'CSV header must match expected schema'
);

// Splitting lines
const lines = csvOutput.replace(/^\uFEFF/, '').trim().split('\r\n');
assert(lines.length === 5, 'Should have header + 4 data rows');

const line1 = lines[1] ?? '';
const line2 = lines[2] ?? '';
const line3 = lines[3] ?? '';
const line4 = lines[4] ?? '';

// Row 1: RFC 4180 escaping with comma and quotes
assert(
  line1.includes('"Nasi padang ""rendang"", es teh"'),
  'Quotes and commas in note should be properly escaped per RFC 4180'
);
assert(line1.includes('expense,35000,Dompet Tunai,Makanan & Minum'), 'Normal expense row values');

// Row 2: Formula injection in note sanitized with ' prefix and raw amount
assert(
  line2.includes(',10000000,') && line2.includes("'=1+1 bonus"),
  'Formula injection starting with = should be prefixed with single quote in text, raw number for amount'
);

// Row 3: Archived resolution
assert(
  line3.includes('Rekening Lama (Arsip)') && line3.includes('Kategori Kuno (Arsip)'),
  'Archived accounts and categories must resolve with (Arsip) suffix'
);
assert(line3.includes("'- Bayar utang lama"), 'Hyphen in text should be sanitized');

// Row 4: Transfer resolution
assert(
  line4.includes('Bank BCA → Rekening Lama (Arsip)'),
  'Transfer account should format as From → To with archive suffix if applicable'
);
assert(line4.includes(',transfer,500000,'), 'Transfer type and amount');
assert(line4.includes(',Transfer,'), 'Transfer category should be Transfer');

// Empty transactions list check
const emptyCsv = exportTransactionsCSV([], accounts, categories);
assert(
  emptyCsv === '\uFEFFtanggal,tipe,jumlah,akun,kategori,catatan\r\n',
  'Empty transaction list should return BOM + header'
);

console.log('exportTransactionsCSV asserts pass');
