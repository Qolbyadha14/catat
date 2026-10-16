import { formatMonthYear } from '../../lib/monthNavigator';

interface MonthNavigatorProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function MonthNavigator({
  currentDate,
  onPrevMonth,
  onNextMonth,
}: MonthNavigatorProps) {
  // ponytail: pure in-memory month navigator. Add jump-to-today button or month picker modal when user asks.
  return (
    <div className="month-navigator" aria-label="Navigasi bulan">
      <button
        type="button"
        className="btn-month-nav"
        onClick={onPrevMonth}
        aria-label="Bulan sebelumnya"
        title="Bulan sebelumnya"
      >
        ‹
      </button>
      <div className="month-navigator-label" aria-live="polite">
        {formatMonthYear(currentDate)}
      </div>
      <button
        type="button"
        className="btn-month-nav"
        onClick={onNextMonth}
        aria-label="Bulan berikutnya"
        title="Bulan berikutnya"
      >
        ›
      </button>
    </div>
  );
}
