import { filterCategoriesByType, getRecommendedCategory } from './CategoryChipGrid';
import type { Category } from '../../lib/schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

const mockCategories: Category[] = [
  { id: 'c1', name: 'Makan & Minum', type: 'expense', icon: '🍔', isArchived: false, createdAt: 1 },
  { id: 'c2', name: 'Gaji', type: 'income', icon: '💰', isArchived: false, createdAt: 1 },
  { id: 'c3', name: 'Archived Cat', type: 'expense', icon: '📦', isArchived: true, createdAt: 1 },
];

// Test 1: filter active categories by transaction type
const expenseCats = filterCategoriesByType(mockCategories, 'expense');
assert(expenseCats.length === 1 && expenseCats[0]?.id === 'c1', 'filters out archived and non-matching types');

// Test 2: filter income categories
const incomeCats = filterCategoriesByType(mockCategories, 'income');
assert(incomeCats.length === 1 && incomeCats[0]?.id === 'c2', 'filters active income categories');

// Test 3: AI recommendation resolver
const rec = getRecommendedCategory(expenseCats, 'c1');
assert(rec?.id === 'c1', 'resolves recommended category');

const noRec = getRecommendedCategory(expenseCats, 'unknown_id');
assert(noRec === null, 'returns null for unmatched recommendation');

console.log('CategoryChipGrid logic tests pass');
