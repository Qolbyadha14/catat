import type { Transaction } from '../../lib/schemas';
import {
  exportTransactionsCSV,
  downloadCSV,
  type AccountLookup,
  type CategoryLookup,
} from '../../lib/exportTransactionsCSV';

export interface TransactionHistoryHeaderProps {
  transactionCount: number;
  searchInput: string;
  onSearchChange: (value: string) => void;
  activeFilterCount: number;
  onOpenFilter: () => void;
  filteredTransactions?: Transaction[];
  accountMap?: AccountLookup;
  categoryMap?: CategoryLookup;
  onExport?: () => void;
  isExportDisabled?: boolean;
}

export function TransactionHistoryHeader({
  transactionCount,
  searchInput,
  onSearchChange,
  activeFilterCount,
  onOpenFilter,
  filteredTransactions,
  accountMap,
  categoryMap,
  onExport,
  isExportDisabled: propIsExportDisabled,
}: TransactionHistoryHeaderProps) {
  const isExportDisabled =
    propIsExportDisabled !== undefined
      ? propIsExportDisabled
      : filteredTransactions
      ? filteredTransactions.length === 0
      : transactionCount === 0;

  const handleExport = () => {
    if (isExportDisabled) return;
    if (onExport) {
      onExport();
      return;
    }
    if (filteredTransactions && accountMap && categoryMap) {
      const csv = exportTransactionsCSV(filteredTransactions, accountMap, categoryMap);
      const today = new Date().toISOString().split('T')[0];
      downloadCSV(`transaksi-${today}.csv`, csv);
    }
  };

  return (
    <>
      <div className="section-header">
        <span className="section-title">Riwayat Transaksi</span>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {transactionCount} transaksi
        </span>
      </div>

      <div className="filters-bar">
        <div className="search-filter-row">
          <div className="search-input-wrap">
            <input
              type="search"
              placeholder="Cari catatan..."
              className="search-input"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Cari catatan"
            />
          </div>
          <button
            type="button"
            className={`btn-filter-trigger ${activeFilterCount > 0 ? 'has-active' : ''}`}
            onClick={onOpenFilter}
            aria-label="Filter transaksi"
            title="Buka filter transaksi"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="filter-badge-counter">{activeFilterCount}</span>
            )}
          </button>
          <button
            type="button"
            className="btn-export-trigger"
            onClick={handleExport}
            disabled={isExportDisabled}
            aria-label="Ekspor CSV"
            title="Ekspor CSV"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
