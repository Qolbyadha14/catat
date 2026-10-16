import { isNameUnique } from './manageValidation';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const items = [
  { id: '1', name: 'Dompet Tunai', isArchived: false },
  { id: '2', name: 'BCA Utama', isArchived: false },
  { id: '3', name: 'Tabungan Lama', isArchived: true },
];

// 1. Rejects duplicate active name (case-insensitive & trimmed)
assert(!isNameUnique('  dompet tunai  ', items), 'Duplicate active name must fail');
assert(!isNameUnique('BCA UTAMA', items), 'Uppercase duplicate must fail');

// 2. Allows same name when editing own item
assert(isNameUnique('Dompet Tunai', items, '1'), 'Same name on self-edit must pass');
assert(isNameUnique('dompet tunai', items, '1'), 'Case variation on self-edit must pass');

// 3. Allows name that is only used by an archived item
assert(isNameUnique('Tabungan Lama', items), 'Name reused from archived item must pass');

// 4. Allows completely unique name
assert(isNameUnique('Gopay', items), 'Unique name must pass');

// 5. Rejects empty or whitespace-only name
assert(!isNameUnique('', items), 'Empty string must fail');
assert(!isNameUnique('   ', items), 'Whitespace-only must fail');

console.log('manageValidation asserts pass');
