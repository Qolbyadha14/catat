import React, { useState, useMemo } from 'react';
import type { Transaction } from '../../lib/schemas';
import { computeWeeklyCashflow, type WeekSummary } from '../../lib/weeklyCashflow';
import { formatIdr } from '../../lib/formatters';

interface WeeklyCashflowChartProps {
  transactions: Transaction[];
  year: number;
  month: number;
  monthLabel: string;
}

export const WeeklyCashflowChart: React.FC<WeeklyCashflowChartProps> = ({
  transactions,
  year,
  month,
  monthLabel,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<WeekSummary | null>(null);

  const data = useMemo(() => {
    return computeWeeklyCashflow(transactions, year, month);
  }, [transactions, year, month]);

  const activeWeek = selectedWeek ?? data.weeks[data.peakExpenseWeekNumber - 1] ?? data.weeks[0];

  return (
    <div className="weekly-chart-card" role="region" aria-label="Grafik Tren Arus Kas Mingguan">
      <div className="weekly-chart-header">
        <div className="weekly-chart-title-wrap">
          <span className="weekly-chart-icon" aria-hidden="true">📊</span>
          <span className="weekly-chart-title">Tren Arus Kas Mingguan</span>
        </div>
        <span className="weekly-chart-month-badge">{monthLabel}</span>
      </div>

      {activeWeek && (
        <div className="weekly-chart-detail-pill">
          <div className="weekly-detail-header">
            <strong>Minggu {activeWeek.weekNumber}</strong>
            <span className="weekly-detail-date">({activeWeek.dateRangeLabel})</span>
          </div>
          <div className="weekly-detail-metrics">
            <span className="metric-income">+{formatIdr(activeWeek.income)}</span>
            <span className="metric-divider">•</span>
            <span className="metric-expense">-{formatIdr(activeWeek.expense)}</span>
            <span className="metric-divider">•</span>
            <span className={`metric-net ${activeWeek.net >= 0 ? 'surplus' : 'deficit'}`}>
              Net: {activeWeek.net >= 0 ? '+' : ''}{formatIdr(activeWeek.net)}
            </span>
          </div>
        </div>
      )}

      <div className="weekly-chart-bars-container">
        {data.weeks.map((w) => {
          const isSelected = activeWeek?.weekNumber === w.weekNumber;
          const isPeak = data.peakExpenseWeekNumber === w.weekNumber && w.expense > 0;

          const incHeight = w.income > 0 ? Math.max(Math.round(w.incomeRatio * 90), 6) : 0;
          const expHeight = w.expense > 0 ? Math.max(Math.round(w.expenseRatio * 90), 6) : 0;

          return (
            <button
              key={w.weekNumber}
              type="button"
              className={`weekly-bar-column ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedWeek(w)}
              aria-label={`Minggu ${w.weekNumber}: Pemasukan ${formatIdr(w.income)}, Pengeluaran ${formatIdr(w.expense)}`}
            >
              {isPeak && <span className="weekly-peak-star" title="Pengeluaran Tertinggi">⚡</span>}
              <div className="weekly-bar-pair">
                <div
                  className="weekly-bar-income"
                  style={{ height: `${incHeight}px` }}
                  title={`Pemasukan: ${formatIdr(w.income)}`}
                />
                <div
                  className="weekly-bar-expense"
                  style={{ height: `${expHeight}px` }}
                  title={`Pengeluaran: ${formatIdr(w.expense)}`}
                />
              </div>
              <span className="weekly-bar-label">M{w.weekNumber}</span>
              <span className="weekly-bar-subdate">{w.startDay}-{w.endDay}</span>
            </button>
          );
        })}
      </div>

      <div className="weekly-chart-footer">
        <div className="weekly-legend">
          <div className="legend-item">
            <span className="legend-dot income" />
            <span>Pemasukan</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot expense" />
            <span>Pengeluaran</span>
          </div>
        </div>
        {data.peakExpenseWeekNumber > 0 && (
          <span className="weekly-peak-hint">
            Puncak belanja: M{data.peakExpenseWeekNumber}
          </span>
        )}
      </div>
    </div>
  );
};
