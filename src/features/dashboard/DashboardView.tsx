import { useState, useEffect, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { Transaction, Account } from '../../lib/schemas';
import { calculateAccountSummary, getAccountDebt } from '../../lib/accountCalculations';
import { useAccounts } from '../accounts/useAccounts';
import { useCategories } from '../categories/useCategories';
import { useTransactions } from '../transactions/useTransactions';
import { deleteTransaction } from '../transactions/transactionService';
import { TransactionFormSheet, type InitialTransferData } from '../transactions/TransactionFormSheet';
import { TransactionFilterSheet } from '../transactions/TransactionFilterSheet';
import { TransactionHistoryHeader } from '../transactions/TransactionHistoryHeader';
import { CategoryBreakdown } from './CategoryBreakdown';
import { MonthNavigator } from './MonthNavigator';
import { ManageSheet } from '../manage/ManageSheet';
import { formatIdr, formatDate } from '../../lib/formatters';
import { shiftMonth, getMonthRange, formatMonthYear } from '../../lib/monthNavigator';
import { calculateNetCashflow } from '../../lib/cashflow';
import { useTheme } from '../../lib/theme';
import {
  filterTransactions,
  countActiveFilters,
  DEFAULT_FILTER_CRITERIA,
  type FilterCriteria,
} from '../../lib/transactionFilter';
import {
  prepareTransactionDuplicate,
  type DuplicateFormValues,
} from '../../lib/transactionDuplicate';
import { FamilyLedgerSheet } from '../family/FamilyLedgerSheet';
import { JoinLedgerDialog } from '../family/JoinLedgerDialog';
import { ProfileMenuPopover } from './ProfileMenuPopover';
import {
  getUserActiveLedgerId,
  setUserActiveLedgerId,
  subscribeToLedger,
  createAndSaveLedger,
} from '../../lib/ledgerService';
import type { Ledger } from '../../lib/schemas';

interface DashboardViewProps {
  user: User;
  onSignOut: () => Promise<void>;
}

export function DashboardView({ user, onSignOut }: DashboardViewProps) {
  const { theme, setTheme } = useTheme();

  // Family Ledger State
  const [activeLedgerId, setActiveLedgerId] = useState<string | null>(null);
  const [activeLedger, setActiveLedger] = useState<Ledger | null>(null);
  const [isFamilySheetOpen, setIsFamilySheetOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinCodeFromUrl, setJoinCodeFromUrl] = useState('');
  const [isCreatingLedger, setIsCreatingLedger] = useState(false);

  const { accounts, loading: accLoading } = useAccounts(user.uid, activeLedgerId || undefined);
  const { categories, loading: catLoading } = useCategories(user.uid, activeLedgerId || undefined);
  const { transactions, loading: txLoading } = useTransactions(user.uid, 50, activeLedgerId || undefined);

  const userProfileCreator = useMemo(() => ({
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Pengguna',
    photoURL: user.photoURL || undefined,
  }), [user]);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Search & Filter state
  const [searchInput, setSearchInput] = useState<string>('');
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>(DEFAULT_FILTER_CRITERIA);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setFilterCriteria((prev) => ({ ...prev, keyword: val }));
  };

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [duplicateData, setDuplicateData] = useState<DuplicateFormValues | null>(null);
  const [transferPrefill, setTransferPrefill] = useState<InitialTransferData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const handleDuplicate = (tx: Transaction) => {
    const dup = prepareTransactionDuplicate(tx, accounts, categories);
    setEditingTx(null);
    setDuplicateData(dup);
    setTransferPrefill(null);
    setIsSheetOpen(true);
  };

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

  // Listen for invite code in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code') || params.get('join');
      if (code) {
        setJoinCodeFromUrl(code.toUpperCase());
        setIsJoinDialogOpen(true);
      }
    }
  }, []);

  // Fetch active ledger on mount
  useEffect(() => {
    getUserActiveLedgerId(user.uid).then((storedLedgerId) => {
      if (storedLedgerId) {
        setActiveLedgerId(storedLedgerId);
      }
    });
  }, [user.uid]);

  // Subscribe to real-time updates for active ledger
  useEffect(() => {
    if (!activeLedgerId) {
      setActiveLedger(null);
      return;
    }
    const unsub = subscribeToLedger(activeLedgerId, (ledger) => {
      setActiveLedger(ledger);
    });
    return () => unsub();
  }, [activeLedgerId]);

  const handleCreateLedger = async () => {
    try {
      setIsCreatingLedger(true);
      const newLedger = await createAndSaveLedger(userProfileCreator);
      setActiveLedgerId(newLedger.id);
      setActiveLedger(newLedger);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membuat buku kas keluarga');
    } finally {
      setIsCreatingLedger(false);
    }
  };

  const handleSwitchToPersonal = async () => {
    await setUserActiveLedgerId(user.uid, null);
    setActiveLedgerId(null);
    setActiveLedger(null);
  };

  const handleJoinSuccess = (joinedLedger: Ledger) => {
    setActiveLedgerId(joinedLedger.id);
    setActiveLedger(joinedLedger);
  };

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts]);
  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories]);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; icon?: string; isArchived?: boolean; monthlyBudget?: number }>();
    categories.forEach((c) =>
      map.set(c.id, { name: c.name, icon: c.icon, isArchived: c.isArchived, monthlyBudget: c.monthlyBudget })
    );
    return map;
  }, [categories]);

  // Account map for quick lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, { name: string; isArchived?: boolean }>();
    accounts.forEach((a) => map.set(a.id, { name: a.name, isArchived: a.isArchived }));
    return map;
  }, [accounts]);

  // Account summary calculation (assets, liabilities, net worth)
  const accountSummary = useMemo(() => calculateAccountSummary(accounts), [accounts]);

  const handlePayBill = (liabilityAccount: Account) => {
    const debt = getAccountDebt(liabilityAccount);
    const primaryAsset =
      accountSummary.assetAccounts.find((a) => a.balance > 0) || accountSummary.assetAccounts[0];
    if (!primaryAsset) {
      alert('Tidak ada akun kas/bank untuk membayar tagihan. Tambahkan akun kas/bank terlebih dahulu.');
      return;
    }
    setEditingTx(null);
    setDuplicateData(null);
    setTransferPrefill({
      fromAccountId: primaryAsset.id,
      toAccountId: liabilityAccount.id,
      amount: debt,
      note: `Pelunasan ${liabilityAccount.name}`,
    });
    setIsSheetOpen(true);
  };

  // Month summary & navigation state
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { startOfMonth, endOfMonth } = useMemo(
    () => getMonthRange(selectedMonth),
    [selectedMonth]
  );

  const monthLabel = useMemo(() => formatMonthYear(selectedMonth), [selectedMonth]);

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, 1));
  };

  const { monthIncome, monthExpense, netCashflow } = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach((tx) => {
      if (tx.date >= startOfMonth && tx.date < endOfMonth) {
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
    });
    return {
      monthIncome: income,
      monthExpense: expense,
      netCashflow: calculateNetCashflow(income, expense),
    };
  }, [transactions, startOfMonth, endOfMonth]);

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

  const openDeleteModal = (tx: Transaction) => {
    setTxToDelete(tx);
    deleteDialogRef.current?.showModal();
  };

  const closeDeleteModal = () => {
    deleteDialogRef.current?.close();
    setTxToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    try {
      setDeletingId(txToDelete.id);
      await deleteTransaction(user.uid, txToDelete.id, activeLedgerId || undefined);
      closeDeleteModal();
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
            className={`btn-header-family ${activeLedger ? 'active' : ''}`}
            onClick={() => setIsFamilySheetOpen(true)}
            title={activeLedger ? `Buku Kas: ${activeLedger.name}` : 'Buku Kas Keluarga'}
            aria-label="Buku Kas Keluarga"
          >
            <span className="btn-family-icon">👥</span>
            <span className="btn-family-label">{activeLedger ? activeLedger.name : 'Keluarga'}</span>
            {activeLedger && <span className="family-badge-dot" title="Mode Kas Bersama Aktif" />}
          </button>
          <button
            type="button"
            className="btn-header-avatar"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            title="Menu Profil & Pengaturan"
            aria-label="Menu Profil & Pengaturan"
            aria-expanded={isProfileMenuOpen}
          >
            <div className="user-avatar" title={user.email ?? ''}>
              {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'U'}
            </div>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {/* Month Navigator */}
        <MonthNavigator
          currentDate={selectedMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />

        {/* Balance Hero Card */}
        <div className="hero-card">
          <div className="hero-label">{accountSummary.hasLiabilities ? 'Saldo Bersih' : 'Total Saldo'}</div>
          <div className="hero-balance">{formatIdr(accountSummary.netBalance)}</div>
          {accountSummary.totalLiabilities > 0 && (
            <div className="hero-liabilities-breakdown">
              <span className="hero-breakdown-item">
                <span className="hero-breakdown-label">💰 Total Aset:</span> {formatIdr(accountSummary.totalAssets)}
              </span>
              <span className="hero-breakdown-divider">•</span>
              <span className="hero-breakdown-item text-danger">
                <span className="hero-breakdown-label">💳 Tagihan PayLater:</span> {formatIdr(accountSummary.totalLiabilities)}
              </span>
            </div>
          )}
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-title">Pemasukan {monthLabel}</span>
              <span className="stat-val-income">+{formatIdr(monthIncome)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-title">Pengeluaran {monthLabel}</span>
              <span className="stat-val-expense">-{formatIdr(monthExpense)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-title">Arus Kas Bersih</span>
              <span className={netCashflow.isSurplus ? 'stat-val-income' : 'stat-val-expense'}>
                {netCashflow.formatted}
              </span>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <CategoryBreakdown
          transactions={transactions}
          categoryMap={categoryMap}
          startOfMonth={startOfMonth}
          endOfMonth={endOfMonth}
          monthLabel={monthLabel}
        />

        {/* Accounts Section */}
        <section className="accounts-dashboard-section">
          <div className="section-header" style={{ marginBottom: 10 }}>
            <span className="section-title">Kantong Akun</span>
            {accountSummary.liabilityAccounts.length > 0 && (
              <span className="accounts-summary-tag">
                {accountSummary.assetAccounts.length} Aset • {accountSummary.liabilityAccounts.length} PayLater
              </span>
            )}
          </div>

          {/* Aset Sub-Group */}
          <div className="accounts-group-block">
            <div className="accounts-group-label">
              <span>💰 Uang Saya (Aset)</span>
              <span className="accounts-group-total">{formatIdr(accountSummary.totalAssets)}</span>
            </div>
            <div className="accounts-scroller">
              {accountSummary.assetAccounts.map((acc) => (
                <div key={acc.id} className="account-chip">
                  <div className="account-chip-icon">{acc.icon || '🏦'}</div>
                  <div className="account-chip-info">
                    <div className="account-chip-name">{acc.name}</div>
                    <div className="account-chip-balance">{formatIdr(acc.balance)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PayLater & Tagihan Sub-Group (if user has liability accounts) */}
          {accountSummary.liabilityAccounts.length > 0 && (
            <div className="accounts-group-block liability-group">
              <div className="accounts-group-label">
                <span>💳 PayLater & Tagihan</span>
                {accountSummary.totalLiabilities > 0 ? (
                  <span className="accounts-group-total liability-total">
                    Tagihan: {formatIdr(accountSummary.totalLiabilities)}
                  </span>
                ) : (
                  <span className="accounts-group-total lunas-total">✓ Semua Lunas</span>
                )}
              </div>
              <div className="accounts-scroller">
                {accountSummary.liabilityAccounts.map((acc) => {
                  const debt = getAccountDebt(acc);
                  return (
                    <div
                      key={acc.id}
                      className={`account-chip liability-chip ${debt > 0 ? 'has-debt' : 'is-settled'}`}
                    >
                      <div className="account-chip-icon">{acc.icon || '💳'}</div>
                      <div className="account-chip-info">
                        <div className="account-chip-name">{acc.name}</div>
                        <div className="account-chip-balance">
                          {debt > 0 ? (
                            <span className="tagihan-badge">Tagihan: {formatIdr(debt)}</span>
                          ) : (
                            <span className="lunas-badge">✓ Rp 0 (Lunas)</span>
                          )}
                        </div>
                      </div>
                      {debt > 0 && (
                        <button
                          type="button"
                          className="btn-pay-tagihan"
                          onClick={() => handlePayBill(acc)}
                          title={`Bayar tagihan ${acc.name}`}
                          aria-label={`Bayar tagihan ${acc.name}`}
                        >
                          ⚡ Bayar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Transactions Section & Filters */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TransactionHistoryHeader
            transactionCount={filteredTransactions.length}
            searchInput={searchInput}
            onSearchChange={handleSearchChange}
            activeFilterCount={activeFilterCount}
            onOpenFilter={() => setIsFilterSheetOpen(true)}
            filteredTransactions={filteredTransactions}
            accountMap={accountMap}
            categoryMap={categoryMap}
          />

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
                    setDuplicateData(null);
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
                        <span className="tx-sub">
                          {sub}
                          {tx.createdBy?.name && (
                            <>
                              {' • '}
                              <span className="tx-creator-pill" title={`Dicatat oleh ${tx.createdBy.name}`}>
                                <span className="tx-creator-avatar">
                                  {tx.createdBy.name.slice(0, 1).toUpperCase()}
                                </span>
                                {tx.createdBy.name}
                              </span>
                            </>
                          )}
                          {tx.items && tx.items.length > 0 && (
                            <>
                              {' • '}
                              <span className="tx-items-indicator" title={`${tx.items.length} rincian barang`}>
                                🛒 {tx.items.length} item
                              </span>
                            </>
                          )}
                        </span>
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
                          className="btn-tx-duplicate"
                          title="Duplikat transaksi"
                          aria-label="Duplikat transaksi"
                          onClick={() => handleDuplicate(tx)}
                        >
                          📋
                        </button>
                        <button
                          type="button"
                          className="btn-tx-edit"
                          title="Ubah transaksi"
                          aria-label="Ubah transaksi"
                          onClick={() => {
                            setEditingTx(tx);
                            setDuplicateData(null);
                            setIsSheetOpen(true);
                          }}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn-tx-delete"
                          title="Hapus transaksi"
                          aria-label="Hapus transaksi"
                          disabled={deletingId === tx.id}
                          onClick={() => openDeleteModal(tx)}
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
            setDuplicateData(null);
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
          key={editingTx?.id ?? (duplicateData ? 'dup' : (transferPrefill ? 'pay' : 'new'))}
          uid={user.uid}
          isOpen={isSheetOpen}
          onClose={() => {
            setIsSheetOpen(false);
            setEditingTx(null);
            setDuplicateData(null);
            setTransferPrefill(null);
          }}
          accounts={activeAccounts}
          categories={activeCategories}
          initialTx={editingTx}
          duplicateData={duplicateData}
          initialTransfer={transferPrefill}
          createdBy={userProfileCreator}
          ledgerId={activeLedgerId || undefined}
          existingTransactions={transactions}
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

      {/* Profile & Settings Popover Menu */}
      <ProfileMenuPopover
        user={user}
        isOpen={isProfileMenuOpen}
        onClose={() => setIsProfileMenuOpen(false)}
        onOpenManage={() => {
          setIsProfileMenuOpen(false);
          setIsManageOpen(true);
        }}
        onSignOut={onSignOut}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Native Delete Confirmation Dialog */}
      <dialog
        ref={deleteDialogRef}
        className="delete-dialog"
        onCancel={closeDeleteModal}
        onClick={(e) => {
          if (e.target === deleteDialogRef.current) {
            closeDeleteModal();
          }
        }}
      >
        {txToDelete && (
          <div className="delete-dialog-content">
            <h3 className="delete-dialog-title">Konfirmasi Hapus</h3>
            <p className="delete-dialog-desc">
              Hapus transaksi{' '}
              <strong>{formatIdr(txToDelete.amount)}</strong> (
              {txToDelete.type === 'transfer'
                ? `${accountMap.get(txToDelete.fromAccountId)?.name ?? 'Akun'} ➔ ${accountMap.get(txToDelete.toAccountId)?.name ?? 'Akun'}`
                : (categoryMap.get(txToDelete.categoryId)?.name ?? 'Kategori')}
              , {formatDate(txToDelete.date)})?
            </p>
            {txToDelete.type === 'transfer' && (
              <div className="delete-dialog-warning">
                ⚠️ Transaksi transfer: kedua sisi transfer (rekening asal dan tujuan) akan ikut terhapus secara atomik dan saldo masing-masing dikembalikan.
              </div>
            )}
            <div className="delete-dialog-actions">
              <button
                type="button"
                className="btn-dialog-cancel"
                onClick={closeDeleteModal}
                disabled={deletingId !== null}
                autoFocus
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-dialog-delete"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Family Ledger Sheet */}
      <FamilyLedgerSheet
        isOpen={isFamilySheetOpen}
        onClose={() => setIsFamilySheetOpen(false)}
        currentUserId={user.uid}
        activeLedger={activeLedger}
        onOpenJoinDialog={() => setIsJoinDialogOpen(true)}
        onSwitchToPersonal={activeLedger ? handleSwitchToPersonal : undefined}
        onCreateLedger={handleCreateLedger}
        isCreating={isCreatingLedger}
      />

      {/* Join Ledger Dialog */}
      <JoinLedgerDialog
        isOpen={isJoinDialogOpen}
        onClose={() => setIsJoinDialogOpen(false)}
        initialCode={joinCodeFromUrl}
        currentUser={userProfileCreator}
        onJoinSuccess={handleJoinSuccess}
      />
    </div>
  );
}
