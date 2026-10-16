import { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { useAccounts } from '../accounts/useAccounts';
import { useCategories } from '../categories/useCategories';
import { useTransactions } from '../transactions/useTransactions';
import { deleteTransaction } from '../transactions/transactionService';
import { TransactionFormSheet } from '../transactions/TransactionFormSheet';
import { formatIdr, formatDate } from '../../lib/formatters';

interface DashboardViewProps {
  user: User;
  onSignOut: () => Promise<void>;
}

export function DashboardView({ user, onSignOut }: DashboardViewProps) {
  const { accounts, loading: accLoading } = useAccounts(user.uid);
  const { categories, loading: catLoading } = useCategories(user.uid);
  const { transactions, loading: txLoading } = useTransactions(user.uid);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [keyword, setKeyword] = useState<string>('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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

  // Totals calculation
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

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (keyword.trim()) {
        const q = keyword.toLowerCase();
        const noteMatch = tx.note?.toLowerCase().includes(q);
        const catName = tx.type !== 'transfer' ? categoryMap.get(tx.categoryId)?.name.toLowerCase() : '';
        const catMatch = catName?.includes(q);
        if (!noteMatch && !catMatch) return false;
      }
      return true;
    });
  }, [transactions, filterType, keyword, categoryMap]);

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
            <div className="type-filter-pills">
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                Semua
              </button>
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'expense' ? 'active' : ''}`}
                onClick={() => setFilterType('expense')}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'income' ? 'active' : ''}`}
                onClick={() => setFilterType('income')}
              >
                Pemasukan
              </button>
              <button
                type="button"
                className={`type-filter-btn ${filterType === 'transfer' ? 'active' : ''}`}
                onClick={() => setFilterType('transfer')}
              >
                Transfer
              </button>
            </div>
          </div>

          {/* List or Empty State */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)' }}>
              Memuat data transaksi...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-illustration">📝</div>
              <h3>Belum ada transaksi</h3>
              <p>Mulai catat transaksi pertamamu untuk melacak pemasukan dan pengeluaran.</p>
              <button
                type="button"
                className="btn-hero"
                style={{ width: 'auto', padding: '0 20px', height: 42, marginTop: 6 }}
                onClick={() => setIsSheetOpen(true)}
              >
                + Catat Transaksi Pertama
              </button>
            </div>
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
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Bottom Action */}
      <div className="fab-bottom">
        <button type="button" className="btn-hero" onClick={() => setIsSheetOpen(true)}>
          + Catat Transaksi
        </button>
      </div>

      {/* Bottom Sheet Form */}
      <TransactionFormSheet
        uid={user.uid}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
