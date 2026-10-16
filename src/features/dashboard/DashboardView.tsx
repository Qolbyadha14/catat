import { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type { Transaction } from '../../lib/schemas';
import { useAccounts } from '../accounts/useAccounts';
import { useCategories } from '../categories/useCategories';
import { useTransactions } from '../transactions/useTransactions';
import { deleteTransaction } from '../transactions/transactionService';
import { TransactionFormSheet } from '../transactions/TransactionFormSheet';
import { TransactionFilterSheet } from '../transactions/TransactionFilterSheet';
import { ManageSheet } from '../manage/ManageSheet';
import { formatIdr, formatDate } from '../../lib/formatters';
import { useTheme, type ThemeMode } from '../../lib/theme';
import {
  filterTransactions,
  countActiveFilters,
  DEFAULT_FILTER_CRITERIA,
  type FilterCriteria,
} from '../../lib/transactionFilter';

interface DashboardViewProps {
  user: User;
  onSignOut: () => Promise<void>;
}

export function DashboardView({ user, onSignOut }: DashboardViewProps) {
  const { theme, setTheme } = useTheme();
  const { accounts, loading: accLoading } = useAccounts(user.uid);
  const { categories, loading: catLoading } = useCategories(user.uid);
  const { transactions, loading: txLoading } = useTransactions(user.uid);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Search & Filter state
  const [searchInput, setSearchInput] = useState<string>('');
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>(DEFAULT_FILTER_CRITERIA);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);

  // Debounce search input 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterCriteria((prev) => ({ ...prev, keyword: searchInput }));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
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

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts]);
  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories]);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; icon?: string; isArchived?: boolean }>();
    categories.forEach((c) =>
      map.set(c.id, { name: c.name, icon: c.icon, isArchived: c.isArchived })
    );
    return map;
  }, [categories]);

  // Account map for quick lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, { name: string; isArchived?: boolean }>();
    accounts.forEach((a) => map.set(a.id, { name: a.name, isArchived: a.isArchived }));
    return map;
  }, [accounts]);

  // Totals calculation (hero saldo stays invariant to filters)
  const totalBalance = useMemo(() => {
    return activeAccounts.reduce((acc, a) => acc + a.balance, 0);
  }, [activeAccounts]);

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

  const activeFilterCount = useMemo(
    () => countActiveFilters(filterCriteria),
    [filterCriteria]
  );

  const isFiltered = activeFilterCount > 0 || searchInput.trim() !== '';

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, filterCriteria, accountMap, categoryMap);
  }, [transactions, filterCriteria, accountMap, categoryMap]);

  const handleResetFilters = () => {
    setSearchInput('');
    setFilterCriteria(DEFAULT_FILTER_CRITERIA);
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
          <button
            type="button"
            className="btn-header-gear"
            onClick={() => setIsManageOpen(true)}
            title="Kelola Akun & Kategori"
            aria-label="Kelola Akun & Kategori"
          >
            ⚙️
          </button>
          <div className="theme-toggle-wrap" title="Pilih tema">
            <span className="theme-toggle-icon" aria-hidden="true">
              {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🌓'}
            </span>
            <select
              className="theme-select"
              aria-label="Pilih tema"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeMode)}
            >
              <option value="system">Tema: Ikuti sistem</option>
              <option value="light">Tema: Terang</option>
              <option value="dark">Tema: Gelap</option>
            </select>
          </div>
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
            {activeAccounts.map((acc) => (
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
            <div className="search-filter-row">
              <div className="search-input-wrap">
                <input
                  type="search"
                  placeholder="Cari catatan..."
                  className="search-input"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  aria-label="Cari catatan"
                />
              </div>
              <button
                type="button"
                className={`btn-filter-trigger ${activeFilterCount > 0 ? 'has-active' : ''}`}
                onClick={() => setIsFilterSheetOpen(true)}
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
                <div className="empty-illustration" style={{ opacity: 0.5 }}>🔍</div>
                <h3>Tidak ada transaksi cocok</h3>
                <p>Coba sesuaikan kata kunci atau atur ulang filter pencarian.</p>
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={handleResetFilters}
                >
                  Reset filter
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
                  const fromAcc = accountMap.get(tx.fromAccountId);
                  const toAcc = accountMap.get(tx.toAccountId);
                  const fromName = fromAcc
                    ? `${fromAcc.name}${fromAcc.isArchived ? ' (Arsip)' : ''}`
                    : 'Akun';
                  const toName = toAcc
                    ? `${toAcc.name}${toAcc.isArchived ? ' (Arsip)' : ''}`
                    : 'Akun';
                  title = `${fromName} → ${toName}`;
                  sub = `${formatDate(tx.date)}${tx.note ? ` • ${tx.note}` : ''}`;
                } else {
                  const cat = categoryMap.get(tx.categoryId);
                  if (cat?.icon) icon = cat.icon;
                  const catName = cat
                    ? `${cat.name}${cat.isArchived ? ' (Arsip)' : ''}`
                    : (isIncome ? 'Pemasukan' : 'Pengeluaran');
                  const acc = accountMap.get(tx.accountId);
                  const accName = acc
                    ? `${acc.name}${acc.isArchived ? ' (Arsip)' : ''}`
                    : '';
                  title = catName;
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

      {/* Filter Bottom Sheet */}
      {isFilterSheetOpen && (
        <TransactionFilterSheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          criteria={filterCriteria}
          onApply={(nextCriteria) => setFilterCriteria(nextCriteria)}
          onReset={handleResetFilters}
          accounts={accounts}
          categories={categories}
          transactions={transactions}
        />
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
          accounts={activeAccounts}
          categories={activeCategories}
          initialTx={editingTx}
        />
      )}

      {/* Manage Accounts & Categories Sheet */}
      <ManageSheet
        uid={user.uid}
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
