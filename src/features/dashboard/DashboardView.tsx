import { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type { Transaction } from '../../lib/schemas';
import { useAccounts } from '../accounts/useAccounts';
import { useCategories } from '../categories/useCategories';
import { useTransactions } from '../transactions/useTransactions';
import { deleteTransaction } from '../transactions/transactionService';
import { TransactionFormSheet } from '../transactions/TransactionFormSheet';
import { formatIdr, formatDate } from '../../lib/formatters';
import { isInRange, getPresetRange, type PresetRange } from '../../lib/dateRange';

interface DashboardViewProps {
  user: User;
  onSignOut: () => Promise<void>;
}

type DateFilterMode = 'all' | PresetRange | 'custom';

export function DashboardView({ user, onSignOut }: DashboardViewProps) {
  const { accounts, loading: accLoading } = useAccounts(user.uid);
  const { categories, loading: catLoading } = useCategories(user.uid);
  const { transactions, loading: txLoading } = useTransactions(user.uid);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const pickType = (type: 'all' | 'expense' | 'income' | 'transfer') => {
    setFilterType(type);
    setSelectedCategoryId('all');
  };
  const [keyword, setKeyword] = useState<string>('');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; icon?: string }>();
    categories.forEach((c) => map.set(c.id, { name: c.name, icon: c.icon }));
    return map;
  }, [categories]);

  // Account map for quick lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  // Totals calculation (hero saldo stays invariant to date/other filters)
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, a) => acc + a.balance, 0);
  }, [accounts]);

  // Month summary
  const [startOfMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });

  const { monthIncome, monthExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach((tx) => {
      if (tx.date >= startOfMonth) {
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
    });
    return { monthIncome: income, monthExpense: expense };
  }, [transactions, startOfMonth]);

  const availableFilterCategories = useMemo(() => {
    if (filterType === 'expense') return categories.filter((c) => c.type === 'expense');
    if (filterType === 'income') return categories.filter((c) => c.type === 'income');
    return categories;
  }, [categories, filterType]);

  const activeDateRange = useMemo(() => {
    if (dateFilterMode === 'all') return null;
    if (dateFilterMode === 'custom') return customRange;
    return getPresetRange(dateFilterMode);
  }, [dateFilterMode, customRange]);

  const isFiltered =
    filterType !== 'all' ||
    selectedAccountId !== 'all' ||
    selectedCategoryId !== 'all' ||
    keyword.trim() !== '' ||
    dateFilterMode !== 'all';

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (selectedAccountId !== 'all') {
        if (tx.type === 'transfer') {
          if (tx.fromAccountId !== selectedAccountId && tx.toAccountId !== selectedAccountId) {
            return false;
          }
        } else if (tx.accountId !== selectedAccountId) {
          return false;
        }
      }
      if (selectedCategoryId !== 'all') {
        if (tx.type === 'transfer') return false;
        if (tx.categoryId !== selectedCategoryId) return false;
      }
      if (keyword.trim()) {
        const q = keyword.toLowerCase();
        const noteMatch = tx.note?.toLowerCase().includes(q);
        const catName = tx.type !== 'transfer' ? categoryMap.get(tx.categoryId)?.name.toLowerCase() : '';
        const catMatch = catName?.includes(q);
        if (!noteMatch && !catMatch) return false;
      }
      if (!isInRange(tx.date, activeDateRange)) return false;
      return true;
    });
  }, [transactions, filterType, selectedAccountId, selectedCategoryId, keyword, categoryMap, activeDateRange]);

  const handleResetFilters = () => {
    setFilterType('all');
    setSelectedAccountId('all');
    setSelectedCategoryId('all');
    setKeyword('');
    setDateFilterMode('all');
    setCustomRange(null);
  };

  const handleDelete = async (txId: string) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    try {
      setDeletingId(txId);
      await deleteTransaction(user.uid, txId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeletingId(null);
    }
  };

  const isLoading = accLoading || catLoading || txLoading;

  return (
    <div className="app-container">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner">
          <span>⚠️ Mode offline — data disimpan di perangkat & disinkronkan saat terhubung</span>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand-group">
          <h1>
            Catat <span className="brand-badge">COREBOY</span>
          </h1>
          <p className="brand-sub">Your money, under control.</p>
        </div>
        <div className="user-profile-menu">
          <div className="user-avatar" title={user.email ?? ''}>
            {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'U'}
          </div>
          <button type="button" className="btn-signout" onClick={onSignOut}>
            Keluar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {/* Balance Hero Card */}
        <div className="hero-card">
          <div className="hero-label">Total Saldo</div>
          <div className="hero-balance">{formatIdr(totalBalance)}</div>
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-title">Pemasukan Bulan Ini</span>
              <span className="stat-val-income">+{formatIdr(monthIncome)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-title">Pengeluaran Bulan Ini</span>
              <span className="stat-val-expense">-{formatIdr(monthExpense)}</span>
            </div>
          </div>
        </div>

        {/* Accounts Scroller */}
        <section>
          <div className="section-header" style={{ marginBottom: 10 }}>
            <span className="section-title">Kantong Akun</span>
          </div>
          <div className="accounts-scroller">
            {accounts.map((acc) => (
              <div key={acc.id} className="account-chip">
                <div className="account-chip-name">{acc.name}</div>
                <div className="account-chip-balance">{formatIdr(acc.balance)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Transactions Section & Filters */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-header">
            <span className="section-title">Riwayat Transaksi</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {filteredTransactions.length} transaksi
            </span>
          </div>

          <div className="filters-bar">
            <input
              type="text"
              placeholder="Cari transaksi atau catatan..."
              className="search-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />

            {/* Date Range Chips */}
            <div className="date-range-chips">
              <button
                type="button"
                className={`date-chip ${dateFilterMode === 'all' ? 'active' : ''}`}
                aria-pressed={dateFilterMode === 'all'}
                onClick={() => setDateFilterMode('all')}
              >
                Semua
              </button>
              <button
                type="button"
                className={`date-chip ${dateFilterMode === 'this_month' ? 'active' : ''}`}
                aria-pressed={dateFilterMode === 'this_month'}
                onClick={() => setDateFilterMode('this_month')}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                className={`date-chip ${dateFilterMode === '7d' ? 'active' : ''}`}
                aria-pressed={dateFilterMode === '7d'}
                onClick={() => setDateFilterMode('7d')}
              >
                7 Hari
              </button>
              <button
                type="button"
                className={`date-chip ${dateFilterMode === '30d' ? 'active' : ''}`}
                aria-pressed={dateFilterMode === '30d'}
                onClick={() => setDateFilterMode('30d')}
              >
                30 Hari
              </button>
              <button
                type="button"
                className={`date-chip ${dateFilterMode === 'custom' ? 'active' : ''}`}
                aria-pressed={dateFilterMode === 'custom'}
                onClick={() => {
                  setTempFrom(customRange?.from ?? '');
                  setTempTo(customRange?.to ?? '');
                  setIsCustomPickerOpen(true);
                }}
              >
                {dateFilterMode === 'custom' && customRange ? `${customRange.from} – ${customRange.to}` : 'Kustom'}
              </button>
            </div>

            <div className="type-filter-pills">
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'all' ? 'active' : ''}`}
                aria-pressed={filterType === 'all'}
                onClick={() => pickType('all')}
              >
                Semua Tipe
              </button>
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'expense' ? 'active' : ''}`}
                aria-pressed={filterType === 'expense'}
                onClick={() => pickType('expense')}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'income' ? 'active' : ''}`}
                aria-pressed={filterType === 'income'}
                onClick={() => pickType('income')}
              >
                Pemasukan
              </button>
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'transfer' ? 'active' : ''}`}
                aria-pressed={filterType === 'transfer'}
                onClick={() => pickType('transfer')}
              >
                Transfer
              </button>
            </div>
            <div className="filter-dropdowns-row">
              <select
                className="form-select filter-select"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="all">Semua Akun</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>

              {filterType !== 'transfer' && (
                <select
                  className="form-select filter-select"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <option value="all">Semua Kategori</option>
                  {availableFilterCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* List or Empty State */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)' }}>
              Memuat data transaksi...
            </div>
          ) : filteredTransactions.length === 0 ? (
            isFiltered ? (
              <div className="empty-state-card">
                <div className="empty-illustration">🔍</div>
                <h3>Tidak ada transaksi pada periode ini</h3>
                <p>Coba sesuaikan kata kunci, kategori, akun, atau rentang tanggal filter.</p>
                <button
                  type="button"
                  className="btn-hero"
                  style={{ width: 'auto', padding: '0 20px', height: 42, marginTop: 6 }}
                  onClick={handleResetFilters}
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="empty-state-card">
                <div className="empty-illustration">📝</div>
                <h3>Belum ada transaksi</h3>
                <p>Mulai catat transaksi pertamamu untuk melacak pemasukan dan pengeluaran.</p>
                <button
                  type="button"
                  className="btn-hero"
                  style={{ width: 'auto', padding: '0 20px', height: 42, marginTop: 6 }}
                  onClick={() => {
                    setEditingTx(null);
                    setIsSheetOpen(true);
                  }}
                >
                  + Catat Transaksi Pertama
                </button>
              </div>
            )
          ) : (
            <div className="card-list">
              {filteredTransactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';

                let icon = '💸';
                let title = tx.note || 'Transaksi';
                let sub = formatDate(tx.date);

                if (isTransfer) {
                  icon = '🔄';
                  const fromName = accountMap.get(tx.fromAccountId) || 'Akun';
                  const toName = accountMap.get(tx.toAccountId) || 'Akun';
                  title = `${fromName} → ${toName}`;
                  sub = `${formatDate(tx.date)}${tx.note ? ` • ${tx.note}` : ''}`;
                } else {
                  const cat = categoryMap.get(tx.categoryId);
                  if (cat?.icon) icon = cat.icon;
                  const accName = accountMap.get(tx.accountId) || '';
                  title = cat?.name || (isIncome ? 'Pemasukan' : 'Pengeluaran');
                  sub = `${formatDate(tx.date)} • ${accName}${tx.note ? ` • ${tx.note}` : ''}`;
                }

                return (
                  <div key={tx.id} className="tx-item">
                    <div className="tx-left">
                      <div className="tx-icon">{icon}</div>
                      <div className="tx-info">
                        <span className="tx-title">{title}</span>
                        <span className="tx-sub">{sub}</span>
                      </div>
                    </div>

                    <div className="tx-right">
                      <span
                        className={`tx-amount ${
                          isIncome
                            ? 'tx-amount-income'
                            : isExpense
                            ? 'tx-amount-expense'
                            : 'tx-amount-transfer'
                        }`}
                      >
                        {isIncome ? '+' : isExpense ? '-' : ''}
                        {formatIdr(tx.amount)}
                      </span>
                      <div className="tx-actions">
                        <button
                          type="button"
                          className="btn-tx-edit"
                          onClick={() => {
                            setEditingTx(tx);
                            setIsSheetOpen(true);
                          }}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn-tx-delete"
                          disabled={deletingId === tx.id}
                          onClick={() => handleDelete(tx.id)}
                        >
                          {deletingId === tx.id ? '...' : 'Hapus'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Bottom Action */}
      <div className="fab-bottom">
        <button
          type="button"
          className="btn-hero"
          onClick={() => {
            setEditingTx(null);
            setIsSheetOpen(true);
          }}
        >
          + Catat Transaksi
        </button>
      </div>

      {/* Custom Date Range Picker Bottom Sheet */}
      {isCustomPickerOpen && (
        <div className="sheet-backdrop" onClick={() => setIsCustomPickerOpen(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle-bar">
              <div className="sheet-handle" />
            </div>

            <div className="sheet-header">
              <h3>Pilih Rentang Tanggal</h3>
              <button
                type="button"
                className="btn-close-sheet"
                onClick={() => setIsCustomPickerOpen(false)}
              >
                ✕
              </button>
            </div>

            <form
              className="transaction-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!tempFrom || !tempTo || tempFrom > tempTo) return;
                setCustomRange({ from: tempFrom, to: tempTo });
                setDateFilterMode('custom');
                setIsCustomPickerOpen(false);
              }}
            >
              <div className="form-group">
                <label className="form-label">Dari Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sampai Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  required
                />
              </div>

              {tempFrom && tempTo && tempFrom > tempTo && (
                <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 8 }}>
                  Tanggal mulai tidak boleh melebihi tanggal akhir
                </div>
              )}

              <button
                type="submit"
                className="btn-hero"
                disabled={!tempFrom || !tempTo || tempFrom > tempTo}
              >
                Terapkan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Sheet Form */}
      {isSheetOpen && (
        <TransactionFormSheet
          key={editingTx?.id ?? 'new'}
          uid={user.uid}
          isOpen={isSheetOpen}
          onClose={() => {
            setIsSheetOpen(false);
            setEditingTx(null);
          }}
          accounts={accounts}
          categories={categories}
          initialTx={editingTx}
        />
      )}
    </div>
  );
}
