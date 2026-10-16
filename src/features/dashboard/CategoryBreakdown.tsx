import { useMemo } from 'react';
import type { Transaction } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { computeCategoryBreakdown } from '../../lib/categoryBreakdown';

interface CategoryBreakdownProps {
  transactions: Transaction[];
  categoryMap: Map<string, { name: string; icon?: string; isArchived?: boolean }>;
  startOfMonth: number;
  endOfMonth?: number;
  monthLabel?: string;
}

export function CategoryBreakdown({
  transactions,
  categoryMap,
  startOfMonth,
  endOfMonth,
  monthLabel = 'Bulan Ini',
}: CategoryBreakdownProps) {
  const breakdown = useMemo(
    () => computeCategoryBreakdown(transactions, categoryMap, startOfMonth, endOfMonth),
    // ponytail: in-memory month aggregation only. Add custom date range / multi-month selector when user asks.
    [transactions, categoryMap, startOfMonth, endOfMonth]
  );

  return (
    <div className="category-breakdown-card">
      <div className="category-breakdown-header">
        <span className="category-breakdown-title">Pengeluaran per Kategori</span>
        <span className="category-breakdown-subtitle">{monthLabel}</span>
      </div>

      {breakdown.items.length === 0 ? (
        <div className="category-breakdown-empty">Belum ada pengeluaran {monthLabel.toLowerCase()}</div>
      ) : (
        <div className="category-breakdown-list">
          {breakdown.items.map((item) => (
            <div key={item.categoryId} className="category-breakdown-item">
              <div className="category-breakdown-item-info">
                <span className="category-breakdown-item-name">
                  <span className="category-breakdown-item-icon" aria-hidden="true">
                    {item.categoryIcon}
                  </span>
                  <span>{item.categoryName}</span>
                </span>
                <span className="category-breakdown-item-amount">
                  {formatIdr(item.total)}
                  <span className="category-breakdown-item-pct"> ({item.percentage}%)</span>
                </span>
              </div>
              <div className="category-breakdown-bar-track">
                <div
                  className="category-breakdown-bar-fill"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
