import {
  STORAGE_KEY,
  MAX_TEMPLATES,
  loadTemplates,
  addTemplate,
  deleteTemplate,
  resolveTemplateFallback,
  type TransactionTemplate,
} from './transactionTemplate';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// In-memory localStorage mock for node / bun test runner
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  configurable: true,
  writable: true,
});

// 1. Corrupt JSON fallback to []
{
  store.set(STORAGE_KEY, 'invalid-json{{{');
  const res = loadTemplates();
  assert(Array.isArray(res) && res.length === 0, 'Corrupt JSON must return empty array');
}

// 2. Non-array JSON fallback to []
{
  store.set(STORAGE_KEY, '{"foo":"bar"}');
  const res = loadTemplates();
  assert(Array.isArray(res) && res.length === 0, 'Non-array JSON must return empty array');
}

// 3. Filter out invalid items (missing ID, bad tipe, zero or negative amount)
{
  const messy = [
    { id: 't1', tipe: 'expense', jumlah: 50000, kategori: 'food', akun: 'cash', catatan: '' },
    { id: 't2', tipe: 'unknown', jumlah: 50000, kategori: 'food', akun: 'cash', catatan: '' },
    { id: 't3', tipe: 'expense', jumlah: -10, kategori: 'food', akun: 'cash', catatan: '' },
    { id: 't4', tipe: 'income', jumlah: 100000, kategori: 'salary', akun: 'bank', catatan: 'gaji' },
    null,
    123,
  ];
  store.set(STORAGE_KEY, JSON.stringify(messy));
  const res = loadTemplates();
  assert(res.length === 2, `Expected 2 valid templates, got ${res.length}`);
  assert(res[0]?.id === 't1', 'First item id matches');
  assert(res[1]?.id === 't4', 'Second item id matches');
}

// 4. FIFO cap max 10
{
  store.clear();
  let current: TransactionTemplate[] = [];
  for (let i = 1; i <= 15; i++) {
    current = addTemplate(current, {
      tipe: 'expense',
      jumlah: i * 1000,
      kategori: 'cat_food',
      akun: 'acc_cash',
      catatan: `template ${i}`,
    });
  }
  assert(current.length === MAX_TEMPLATES, `Length must be capped at ${MAX_TEMPLATES}, got ${current.length}`);
  // Newest should be at index 0 (template 15), oldest at end (template 6)
  assert(current[0]?.jumlah === 15000, 'Newest template is at index 0');
  assert(current[current.length - 1]?.jumlah === 6000, 'Oldest kept template is template 6 (FIFO)');
  // Verify persistence
  const reloaded = loadTemplates();
  assert(reloaded.length === MAX_TEMPLATES, 'Reloaded length is 10');
  assert(reloaded[0]?.jumlah === 15000, 'Reloaded head matches');
}

// 5. Delete template
{
  const toDeleteId = loadTemplates()[0]?.id;
  assert(Boolean(toDeleteId), 'Template to delete exists');
  const updated = deleteTemplate(loadTemplates(), toDeleteId!);
  assert(updated.length === 9, 'Deleted item decrements length to 9');
  assert(!updated.some((t) => t.id === toDeleteId), 'Deleted item is not present');
}

// 6. Fallback safety when Account or Category is deleted
{
  const accounts = [{ id: 'acc_bank' }, { id: 'acc_ewallet' }];
  const categories = [
    { id: 'cat_food', type: 'expense' },
    { id: 'cat_salary', type: 'income' },
  ];

  // Case A: normal match
  const tplValid: TransactionTemplate = {
    id: 'valid_1',
    tipe: 'expense',
    jumlah: 25000,
    kategori: 'cat_food',
    akun: 'acc_bank',
    catatan: 'makan',
    createdAt: 1,
  };
  const resValid = resolveTemplateFallback(tplValid, accounts, categories);
  assert(resValid.accountId === 'acc_bank', 'Valid account resolved');
  assert(resValid.categoryId === 'cat_food', 'Valid category resolved');

  // Case B: account and category deleted from store
  const tplOrphan: TransactionTemplate = {
    id: 'orphan_1',
    tipe: 'expense',
    jumlah: 45000,
    kategori: 'cat_deleted',
    akun: 'acc_deleted',
    catatan: 'kopi',
    createdAt: 1,
  };
  const resOrphan = resolveTemplateFallback(tplOrphan, accounts, categories);
  assert(resOrphan.accountId === 'acc_bank', 'Deleted account falls back to first account');
  assert(resOrphan.categoryId === 'cat_food', 'Deleted category falls back to first category of type');

  // Case C: transfer fallback
  const tplTransfer: TransactionTemplate = {
    id: 'transfer_1',
    tipe: 'transfer',
    jumlah: 50000,
    kategori: '',
    akun: 'acc_bank',
    keAkun: 'acc_deleted_target',
    catatan: 'tarik',
    createdAt: 1,
  };
  const resTransfer = resolveTemplateFallback(tplTransfer, accounts, categories);
  assert(resTransfer.accountId === 'acc_bank', 'Transfer source resolved');
  assert(resTransfer.toAccountId === 'acc_ewallet', 'Transfer target falls back to alternate account');
}

console.log('TransactionTemplate logic asserts pass');
