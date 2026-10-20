import { useState, useEffect, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { Transaction, Account, Category, Ledger } from '../../lib/schemas';
import { calculateAccountSummary, getAccountDebt } from '../../lib/accountCalculations';
import { useAccounts } from '../accounts/useAccounts';
import { useCategories } from '../categories/useCategories';
import { useTransactions } from '../transactions/useTransactions';
import { deleteTransaction } from '../transactions/transactionService';
import { updateCategory } from '../categories/categoryService';
import { TransactionFormSheet, type InitialTransferData } from '../transactions/TransactionFormSheet';
import { TransactionFilterSheet } from '../transactions/TransactionFilterSheet';
import { ManageSheet } from '../manage/ManageSheet';
import { ensureLedgerDefaults, ensureUserDefaults } from '../auth/seedDefaults';
import type { UpcomingBill } from '../../lib/bills';
import { formatIdr, formatDate } from '../../lib/formatters';
import { shiftMonth, getMonthRange, formatMonthYear } from '../../lib/monthNavigator';
import { calculateNetCashflow } from '../../lib/cashflow';
import { useTheme } from '../../lib/theme';
import { isShowcaseMode } from '../../lib/showcaseMockData';
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

// Modern Components
import { MobileFrame } from '../../components/layout/MobileFrame';
import { Header } from '../../components/layout/Header';
import { BottomNav, type NavTabType } from '../../components/navigation/BottomNav';
import { HomeTab } from './HomeTab';
import { AccountsTab } from '../accounts/AccountsTab';
import { BudgetsTab } from '../budgets/BudgetsTab';
import { BudgetModal } from '../budgets/BudgetModal';
import { StatsTab } from '../analytics/StatsTab';
import { SearchModal } from '../../components/modals/SearchModal';

interface DashboardViewProps {
  user: User;
  onSignOut: () => Promise<void>;
  onOpenAdmin?: () => void;
}

export function DashboardView({ user, onSignOut, onOpenAdmin }: DashboardViewProps) {

  const { theme, setTheme } = useTheme();

  // Navigation Tab State
  const [currentTab, setCurrentTab] = useState<NavTabType>('dashboard');

  // Family Ledger State
  const [activeLedgerId, setActiveLedgerId] = useState<string | null>(null);
  const [activeLedger, setActiveLedger] = useState<Ledger | null>(null);
  const [isFamilySheetOpen, setIsFamilySheetOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinCodeFromUrl, setJoinCodeFromUrl] = useState('');
  const [isCreatingLedger, setIsCreatingLedger] = useState(false);

  // Firestore Data Hooks
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
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Budget Modal State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState<boolean>(false);
  const [selectedBudgetCat, setSelectedBudgetCat] = useState<Category | null>(null);

  // Sheets & Dialogs State
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

  // Ensure default accounts exist for personal user on mount
  useEffect(() => {
    if (user?.uid && !isShowcaseMode()) {
      ensureUserDefaults(user.uid).catch(console.error);
    }
  }, [user?.uid]);

  // Subscribe to real-time updates for active ledger
  useEffect(() => {
    if (!activeLedgerId) {
      setActiveLedger(null);
      return;
    }
    ensureLedgerDefaults(activeLedgerId).catch(console.error);

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

  const handlePayUpcomingBill = (bill: UpcomingBill) => {
    const targetAccount = accounts.find((a) => a.id === bill.accountId);
    if (targetAccount) {
      handlePayBill(targetAccount);
    }
  };

  const handlePayDebt = (targetAccountId: string, suggestedAmount: number) => {
    const targetAccount = accounts.find((a) => a.id === targetAccountId);
    if (!targetAccount) return;
    const primaryAsset =
      accountSummary.assetAccounts.find((a) => a.balance >= suggestedAmount) ||
      accountSummary.assetAccounts.find((a) => a.balance > 0) ||
      accountSummary.assetAccounts[0];
    if (!primaryAsset) {
      alert('Tidak ada akun kas/bank untuk membayar cicilan. Tambahkan akun kas/bank terlebih dahulu.');
      return;
    }
    setEditingTx(null);
    setDuplicateData(null);
    setTransferPrefill({
      fromAccountId: primaryAsset.id,
      toAccountId: targetAccount.id,
      amount: suggestedAmount,
      note: `Cicilan ${targetAccount.name}`,
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

  const handleSaveBudget = async (categoryId: string, limit: number) => {
    await updateCategory(user.uid, categoryId, { monthlyBudget: limit }, activeLedgerId || undefined);
  };

  const isLoading = accLoading || catLoading || txLoading;
  const userInitials = user.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : (user.email ? user.email.slice(0, 2).toUpperCase() : 'U');

  return (
    <MobileFrame activeTab={currentTab}>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 font-bold text-xs py-1.5 px-4 text-center">
          <span>⚠️ Mode offline — data disimpan di perangkat & disinkronkan saat terhubung</span>
        </div>
      )}

      {/* Modern Top Header */}
      <Header
        userName={user.displayName || user.email?.split('@')[0] || 'Pengguna'}
        userPhoto={user.photoURL || undefined}
        userInitials={userInitials}
        activeLedgerName={activeLedger ? activeLedger.name : null}
        onOpenFamilyLedger={() => setIsFamilySheetOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenProfileMenu={() => setIsProfileMenuOpen(true)}
        isProfileMenuOpen={isProfileMenuOpen}
      />

      {/* Main Tab Views */}
      <div className="pt-1 flex-1 flex flex-col min-w-0">
        {currentTab === 'dashboard' && (
          <HomeTab
            netBalance={accountSummary.netBalance}
            totalAssets={accountSummary.totalAssets}
            totalLiabilities={accountSummary.totalLiabilities}
            hasLiabilities={accountSummary.hasLiabilities}
            monthIncome={monthIncome}
            monthExpense={monthExpense}
            netCashflow={netCashflow}
            selectedMonthLabel={monthLabel}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            transactions={transactions}
            filteredTransactions={filteredTransactions}
            accountMap={accountMap}
            categoryMap={categoryMap}
            categories={categories}
            accounts={accounts}
            isLoading={isLoading}
            isFiltered={isFiltered}
            onResetFilters={handleResetFilters}
            onOpenAddModal={() => {
              setEditingTx(null);
              setDuplicateData(null);
              setTransferPrefill(null);
              setIsSheetOpen(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setDuplicateData(null);
              setTransferPrefill(null);
              setIsSheetOpen(true);
            }}
            onDuplicateTransaction={handleDuplicate}
            onDeleteTransaction={openDeleteModal}
            onPayUpcomingBill={handlePayUpcomingBill}
            onOpenBudgetsTab={() => setCurrentTab('budgets')}
          />
        )}

        {currentTab === 'accounts' && (
          <AccountsTab
            accounts={accounts}
            onPayLiability={handlePayBill}
            onPayDebt={handlePayDebt}
            onOpenAddAccount={() => setIsManageOpen(true)}
          />
        )}

        {currentTab === 'budgets' && (
          <BudgetsTab
            categories={categories}
            transactions={transactions}
            onOpenBudgetModal={(cat) => {
              setSelectedBudgetCat(cat);
              setIsBudgetModalOpen(true);
            }}
          />
        )}

        {currentTab === 'stats' && (
          <StatsTab
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            selectedMonth={selectedMonth}
          />
        )}
      </div>

      {/* Floating Bottom Navigation Dock */}
      <BottomNav
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        onOpenAddModal={() => {
          setEditingTx(null);
          setDuplicateData(null);
          setTransferPrefill(null);
          setIsSheetOpen(true);
        }}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        onSelectTransaction={(tx) => {
          setEditingTx(tx);
          setDuplicateData(null);
          setTransferPrefill(null);
          setIsSheetOpen(true);
        }}
      />

      {/* Budget Limit Setting Modal */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => {
          setIsBudgetModalOpen(false);
          setSelectedBudgetCat(null);
        }}
        category={selectedBudgetCat}
        onSaveBudget={handleSaveBudget}
      />

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

      {/* Transaction Form Bottom Sheet */}
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
        ledgerId={activeLedgerId || undefined}
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
        onOpenAdmin={onOpenAdmin}
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
    </MobileFrame>
  );
}
