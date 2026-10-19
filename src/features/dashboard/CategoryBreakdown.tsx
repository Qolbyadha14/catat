import { useMemo } from 'react';
import type { Transaction } from '../../lib/schemas';
import { formatIdr } from '../../lib/formatters';
import { computeCategoryBreakdown } from '../../lib/categoryBreakdown';

interface CategoryBreakdownProps {
  transactions: Transaction[];
  categoryMap: Map<string, { name: string; icon?: string; isArchived?: boolean; monthlyBudget?: number }>;
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
          {breakdown.items.map((item) => {
            const hasBudget = Boolean(item.monthlyBudget && item.monthlyBudget > 0);
            const fillWidth = hasBudget
              ? Math.min(100, item.budgetPercentage ?? item.percentage)
              : item.percentage;

            const statusClass = hasBudget && item.budgetStatus ? `bar-${item.budgetStatus}` : '';

            return (
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
                    {hasBudget ? (
                      <span className="category-breakdown-item-budget">
                        {' '}/ {formatIdr(item.monthlyBudget!)}
                        <span className={`category-breakdown-badge ${statusClass}`}>
                          {' '}({item.budgetPercentage}%)
                        </span>
                      </span>
                    ) : (
                      <span className="category-breakdown-item-pct"> ({item.percentage}%)</span>
                    )}
                  </span>
                </div>
                <div className="category-breakdown-bar-track">
                  <div
                    className={`category-breakdown-bar-fill ${statusClass}`}
                    style={{ width: `${fillWidth}%` }}
                  />
                </div>
                {hasBudget && (
                  <div className="category-budget-pace-row">
                    {item.budgetStatus === 'exceeded' ? (
                      <span className="category-budget-pace-text exceeded">
                        ⚠️ Overbudget {formatIdr(item.overbudgetAmount || 0)}
                      </span>
                    ) : (
                      <span className="category-budget-pace-text">
                        Sisa {formatIdr(item.budgetRemaining || 0)} • Kuota aman {formatIdr(item.safeDailyPace || 0)}/hari
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
