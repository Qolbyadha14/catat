import type { Category } from '../../lib/schemas';

export interface CategoryChipGridProps {
  categories: Category[];
  type: 'expense' | 'income';
  selectedId: string;
  onSelect: (id: string) => void;
  recommendedId?: string | null;
}

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

export function CategoryChipGrid({
  categories,
  type,
  selectedId,
  onSelect,
  recommendedId,
}: CategoryChipGridProps) {
  const activeCategories = filterCategoriesByType(categories, type);

  if (activeCategories.length === 0) {
    return (
      <div className="category-empty-state">
        Belum ada kategori {type === 'expense' ? 'pengeluaran' : 'pemasukan'}.
      </div>
    );
  }

  return (
    <div className="category-chip-grid" role="radiogroup" aria-label="Pilih Kategori">
      {activeCategories.map((cat) => {
        const isSelected = cat.id === selectedId;
        const isRecommended = Boolean(recommendedId && cat.id === recommendedId);

        return (
          <button
            key={cat.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`category-chip ${isSelected ? 'active' : ''} ${
              isRecommended ? 'recommended-ai' : ''
            }`}
            onClick={() => onSelect(cat.id)}
            title={isRecommended ? `${cat.name} (Rekomendasi AI)` : cat.name}
          >
            <span className="category-chip-icon" aria-hidden="true">
              {cat.icon || '📁'}
            </span>
            <span className="category-chip-name">{cat.name}</span>
            {isRecommended && (
              <span className="category-chip-badge" title="Rekomendasi AI dari struk">
                ✨ AI
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
