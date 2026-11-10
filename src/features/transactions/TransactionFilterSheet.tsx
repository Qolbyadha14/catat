import { useState, useMemo } from 'react';
import type { Account, Category, Transaction } from '../../lib/schemas';
import type { FilterCriteria, FilterType } from '../../lib/transactionFilter';
import { useEscapeKey } from '../../lib/useEscapeKey';

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

  useEscapeKey(isOpen, onClose);

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

    // Transfer tidak punya kategori
    if (draftType === 'transfer') return [];
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
    // Rentang tanggal mengikuti navigator bulan, jadi filter tanggal di sini selalu 'all'
    onApply({
      ...criteria,
      type: draftType,
      accountIds: draftAccountIds,
      categoryIds: draftType === 'transfer' ? [] : draftCategoryIds,
      datePreset: 'all',
      customRange: null,
    });
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
      >
        <div className="sheet-handle-bar">
          <div className="sheet-handle" />
        </div>

        <div className="sheet-header">
          <h3 id="filter-sheet-title">Filter Transaksi</h3>
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
              <button
                type="button"
                className={`type-btn ${draftType === 'transfer' ? 'active' : ''}`}
                onClick={() => setDraftType('transfer')}
              >
                Transfer
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
