import type { Category } from '../../lib/schemas';

export function filterCategoriesByType(
  categories: Category[],
  type: 'expense' | 'income'
): Category[] {
  return categories.filter((c) => !c.isArchived && c.type === type);
}

export function getRecommendedCategory(
  categories: Category[],
  recommendedId?: string | null
): Category | null {
  if (!recommendedId) return null;
  return categories.find((c) => c.id === recommendedId) ?? null;
}
