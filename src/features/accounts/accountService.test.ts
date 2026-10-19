import { sanitizeAccountUpdate } from './accountService';
import { sanitizeCategoryUpdate } from '../categories/categoryService';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Account whitelist test: strips balance, kind, id, createdAt
const accountInput = {
  id: 'acc_fake',
  balance: 9999999,
  kind: 'liability',
  createdAt: 1234567,
  name: '   Dompet Baru   ',
  icon: '👛',
  isArchived: true,
};

const sanitizedAcc = sanitizeAccountUpdate(accountInput);
assert(sanitizedAcc.name === 'Dompet Baru', 'name must be trimmed');
assert(sanitizedAcc.icon === '👛', 'icon must be kept');
assert(sanitizedAcc.isArchived === true, 'isArchived must be kept');
assert(!('balance' in sanitizedAcc), 'balance must be stripped');
assert(!('kind' in sanitizedAcc), 'kind must be stripped');
assert(!('id' in sanitizedAcc), 'id must be stripped');
assert(!('createdAt' in sanitizedAcc), 'createdAt must be stripped');

// Category whitelist test: strips type, id, createdAt
const categoryInput = {
  id: 'cat_fake',
  type: 'income',
  createdAt: 1234567,
  name: '  Kategori Khusus  ',
  icon: '🏷️',
  isArchived: false,
};

// Category monthlyBudget whitelist test
const categoryWithBudget = {
  name: 'Makan & Minum',
  monthlyBudget: 2500000,
};
const sanitizedBudget = sanitizeCategoryUpdate(categoryWithBudget);
assert(sanitizedBudget.monthlyBudget === 2500000, 'monthlyBudget must be preserved as integer');

const categoryWithInvalidBudget = {
  name: 'Makan',
  monthlyBudget: -50000,
};
const sanitizedInvalid = sanitizeCategoryUpdate(categoryWithInvalidBudget);
assert(!('monthlyBudget' in sanitizedInvalid), 'negative monthlyBudget must be stripped');

console.log('Account and Category whitelist sanitizer asserts pass');

