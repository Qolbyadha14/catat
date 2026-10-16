import { useState, useMemo } from 'react';
import type { Account, Category, Transaction } from '../../lib/schemas';
import type { FilterCriteria, FilterType, FilterDatePreset } from '../../lib/transactionFilter';

interface TransactionFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: FilterCriteria;
  onApply: (next: FilterCriteria) => void;
  onReset: () => void;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

export function TransactionFilterSheet({
  isOpen,
  onClose,
  criteria,
  onApply,
  onReset,
  accounts,
  categories,
  transactions,
}: TransactionFilterSheetProps) {
  const [draftType, setDraftType] = useState<FilterType>(criteria.type);
  const [draftAccountIds, setDraftAccountIds] = useState<string[]>(criteria.accountIds);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>(criteria.categoryIds);
  const [draftDatePreset, setDraftDatePreset] = useState<FilterDatePreset>(criteria.datePreset);
  const [draftCustomFrom, setDraftCustomFrom] = useState<string>(criteria.customRange?.from ?? '');
  const [draftCustomTo, setDraftCustomTo] = useState<string>(criteria.customRange?.to ?? '');

  // Accounts list: active + archived that exist in transaction snapshot
  const filterAccounts = useMemo(() => {
    const txAccountIds = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.type === 'transfer') {
        txAccountIds.add(tx.fromAccountId);
        txAccountIds.add(tx.toAccountId);
      } else {
        txAccountIds.add(tx.accountId);
      }
    });

    return accounts.filter((acc) => !acc.isArchived || txAccountIds.has(acc.id));
  }, [accounts, transactions]);

  // Categories list: active + archived that exist in transaction snapshot
  const filterCategories = useMemo(() => {
    const txCategoryIds = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.type !== 'transfer') {
        txCategoryIds.add(tx.categoryId);
      }
    });

    let list = categories.filter((cat) => !cat.isArchived || txCategoryIds.has(cat.id));
    if (draftType === 'expense') list = list.filter((c) => c.type === 'expense');
    if (draftType === 'income') list = list.filter((c) => c.type === 'income');
    return list;
  }, [categories, transactions, draftType]);

  if (!isOpen) return null;

  const toggleAccount = (id: string) => {
    setDraftAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleCategory = (id: string) => {
    setDraftCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const customRange =
      draftDatePreset === 'custom' && draftCustomFrom && draftCustomTo
        ? { from: draftCustomFrom, to: draftCustomTo }
        : null;

    onApply({
      ...criteria,
      type: draftType,
      accountIds: draftAccountIds,
      categoryIds: draftCategoryIds,
      datePreset: draftDatePreset,
      customRange,
    });
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle-bar">
          <div className="sheet-handle" />
        </div>

        <div className="sheet-header">
          <h3>Filter Transaksi</h3>
          <button
            type="button"
            className="btn-close-sheet"
            onClick={onClose}
            aria-label="Tutup filter"
            title="Tutup filter"
          >
            ✕
          </button>
        </div>

        <form className="transaction-form" onSubmit={handleApply}>
          {/* Rentang Tanggal */}
          <div className="form-group">
            <span className="filter-section-title">Rentang Tanggal</span>
            <div className="filter-chip-wrap">
              <button
                type="button"
                className={`filter-chip ${draftDatePreset === 'all' ? 'active' : ''}`}
                onClick={() => setDraftDatePreset('all')}
              >
                Semua
              </button>
              <button
                type="button"
                className={`filter-chip ${draftDatePreset === 'this_month' ? 'active' : ''}`}
                onClick={() => setDraftDatePreset('this_month')}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                className={`filter-chip ${draftDatePreset === 'last_month' ? 'active' : ''}`}
                onClick={() => setDraftDatePreset('last_month')}
              >
                Bulan Lalu
              </button>
              <button
                type="button"
                className={`filter-chip ${draftDatePreset === 'custom' ? 'active' : ''}`}
                onClick={() => setDraftDatePreset('custom')}
              >
                Kustom
              </button>
            </div>

            {draftDatePreset === 'custom' && (
              <div className="custom-date-inputs" style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Dari</label>
                  <input
                    type="date"
                    className="form-input"
                    value={draftCustomFrom}
                    onChange={(e) => setDraftCustomFrom(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Sampai</label>
                  <input
                    type="date"
                    className="form-input"
                    value={draftCustomTo}
                    onChange={(e) => setDraftCustomTo(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tipe Transaksi */}
          <div className="form-group">
            <span className="filter-section-title">Tipe Transaksi</span>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-btn ${draftType === 'all' ? 'active' : ''}`}
                onClick={() => setDraftType('all')}
              >
                Semua
              </button>
              <button
                type="button"
                className={`type-btn ${draftType === 'expense' ? 'active' : ''}`}
                onClick={() => setDraftType('expense')}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className={`type-btn ${draftType === 'income' ? 'active' : ''}`}
                onClick={() => setDraftType('income')}
              >
                Pemasukan
              </button>
            </div>
          </div>

          {/* Akun Multi-select */}
          <div className="form-group">
            <span className="filter-section-title">Akun</span>
            <div className="filter-chip-wrap">
              {filterAccounts.map((acc) => {
                const selected = draftAccountIds.includes(acc.id);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    className={`filter-chip ${selected ? 'active' : ''}`}
                    onClick={() => toggleAccount(acc.id)}
                  >
                    {acc.name}
                    {acc.isArchived ? ' (Arsip)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kategori Multi-select */}
          {filterCategories.length > 0 && (
            <div className="form-group">
              <span className="filter-section-title">Kategori</span>
              <div className="filter-chip-wrap">
                {filterCategories.map((cat) => {
                  const selected = draftCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`filter-chip ${selected ? 'active' : ''}`}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                      {cat.isArchived ? ' (Arsip)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fixed Footer Actions */}
          <div className="filter-sheet-footer">
            <button
              type="button"
              className="btn-outline"
              onClick={handleReset}
            >
              Reset
            </button>
            <button
              type="submit"
              className="btn-solid"
            >
              Terapkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
