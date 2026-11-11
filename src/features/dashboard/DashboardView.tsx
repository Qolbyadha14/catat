import { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type { Transaction, Account, Category } from '../../lib/schemas';
import { calculateAccountSummary, getAccountDebt } from '../../lib/accountCalculations';
import { useAccounts } from '../accounts/useAccounts';
import { useCategories } from '../categories/useCategories';
import { useTransactions } from '../transactions/useTransactions';
import { deleteTransaction } from '../transactions/transactionService';
import { updateCategory } from '../categories/categoryService';
import { TransactionFormSheet, type InitialTransferData } from '../transactions/TransactionFormSheet';
import { TransactionFilterSheet } from '../transactions/TransactionFilterSheet';
import { DeleteTransactionDialog } from '../transactions/DeleteTransactionDialog';
import { ManageSheet } from '../manage/ManageSheet';
import { ensureUserDefaults } from '../auth/seedDefaults';
import type { UpcomingBill } from '../../lib/bills';
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
import { useFamilyLedger } from '../family/useFamilyLedger';
import { ProfileMenuPopover } from './ProfileMenuPopover';

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
import { useToast } from '../../components/feedback/useToast';

interface DashboardViewProps {
  user: User;
  onSignOut: () => Promise<void>;
  onOpenAdmin?: () => void;
}

/** Mode form transaksi; null berarti form tertutup. */
type TransactionSheetState =
  | { mode: 'new' }
  | { mode: 'edit'; tx: Transaction }
  | { mode: 'duplicate'; data: DuplicateFormValues }
  | { mode: 'transfer'; prefill: InitialTransferData };

function readInviteCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('code') || params.get('join') || '').toUpperCase();
}

export function DashboardView({ user, onSignOut, onOpenAdmin }: DashboardViewProps) {
  const showToast = useToast();
  const { theme, setTheme } = useTheme();

  // Navigation Tab State
  const [currentTab, setCurrentTab] = useState<NavTabType>('dashboard');

  // Family Ledger
  const family = useFamilyLedger(user);
  const { activeLedger, savedFamilyLedger } = family;
  const ledgerId = family.activeLedgerId || undefined;
  const [isFamilySheetOpen, setIsFamilySheetOpen] = useState(false);
  // Link undangan (?code=ABC234) langsung membuka dialog gabung
  const [joinCodeFromUrl] = useState(readInviteCodeFromUrl);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(() => joinCodeFromUrl !== '');

  // Month summary & navigation state (dipakai oleh query transaksi, jadi harus di atas hook data)
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { startOfMonth, endOfMonth } = useMemo(
    () => getMonthRange(selectedMonth),
    [selectedMonth]
  );
  const monthRange = useMemo(() => ({ start: startOfMonth, end: endOfMonth }), [startOfMonth, endOfMonth]);

  const monthLabel = useMemo(() => formatMonthYear(selectedMonth), [selectedMonth]);

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, 1));
  };

  // Firestore Data Hooks
  const { accounts, loading: accLoading } = useAccounts(user.uid, ledgerId);
  const { categories, loading: catLoading } = useCategories(user.uid, ledgerId);
  const { transactions, loading: txLoading } = useTransactions(user.uid, monthRange, ledgerId);

  const userProfileCreator = useMemo(() => ({
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Pengguna',
    photoURL: user.photoURL || undefined,
  }), [user]);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Filter state (pencarian teks ada di SearchModal)
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>(DEFAULT_FILTER_CRITERIA);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Budget Modal State
  const [selectedBudgetCat, setSelectedBudgetCat] = useState<Category | null>(null);

  // Sheets & Dialogs State
  const [transactionSheet, setTransactionSheet] = useState<TransactionSheetState | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openNewTransaction = () => setTransactionSheet({ mode: 'new' });
  const openEditTransaction = (tx: Transaction) => setTransactionSheet({ mode: 'edit', tx });
  const openTransferPrefill = (prefill: InitialTransferData) => setTransactionSheet({ mode: 'transfer', prefill });

  const handleDuplicate = (tx: Transaction) => {
    setTransactionSheet({ mode: 'duplicate', data: prepareTransactionDuplicate(tx, accounts, categories) });
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

  // Ensure default accounts exist for personal user on mount
  useEffect(() => {
    if (user?.uid && !isShowcaseMode()) {
      ensureUserDefaults(user.uid).catch(console.error);
    }
  }, [user?.uid]);

  const handleCreateLedger = async () => {
    try {
      await family.createLedger();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat buku kas keluarga');
    }
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
      showToast('Tidak ada akun kas/bank untuk membayar tagihan. Tambahkan akun kas/bank terlebih dahulu.');
      return;
    }
    openTransferPrefill({
      fromAccountId: primaryAsset.id,
      toAccountId: liabilityAccount.id,
      amount: debt,
      note: `Pelunasan ${liabilityAccount.name}`,
    });
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
      showToast('Tidak ada akun kas/bank untuk membayar cicilan. Tambahkan akun kas/bank terlebih dahulu.');
      return;
    }
    openTransferPrefill({
      fromAccountId: primaryAsset.id,
      toAccountId: targetAccount.id,
      amount: suggestedAmount,
      note: `Cicilan ${targetAccount.name}`,
    });
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

  const isFiltered = activeFilterCount > 0;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, filterCriteria, accountMap, categoryMap);
  }, [transactions, filterCriteria, accountMap, categoryMap]);

  const handleResetFilters = () => {
    setFilterCriteria(DEFAULT_FILTER_CRITERIA);
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    try {
      setIsDeleting(true);
      await deleteTransaction(user.uid, txToDelete.id, ledgerId);
      setTxToDelete(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus transaksi');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveBudget = async (categoryId: string, limit: number) => {
    await updateCategory(user.uid, categoryId, { monthlyBudget: limit }, ledgerId);
  };

  const isLoading = accLoading || catLoading || txLoading;
  const userInitials = user.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : (user.email ? user.email.slice(0, 2).toUpperCase() : 'U');

  const sheetKey = !transactionSheet
    ? 'closed'
    : transactionSheet.mode === 'edit'
    ? transactionSheet.tx.id
    : transactionSheet.mode;

  return (
    <MobileFrame activeTab={currentTab}>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 font-bold text-xs py-1.5 px-4 text-center" role="status">
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
            filteredTransactions={filteredTransactions}
            accountMap={accountMap}
            categoryMap={categoryMap}
            accounts={accounts}
            isLoading={isLoading}
            isFiltered={isFiltered}
            activeFilterCount={activeFilterCount}
            onOpenFilter={() => setIsFilterSheetOpen(true)}
            onResetFilters={handleResetFilters}
            onOpenAddModal={openNewTransaction}
            onEditTransaction={openEditTransaction}
            onDuplicateTransaction={handleDuplicate}
            onDeleteTransaction={setTxToDelete}
            onPayUpcomingBill={handlePayUpcomingBill}
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
            selectedMonth={selectedMonth}
            onOpenBudgetModal={setSelectedBudgetCat}
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
        onOpenAddModal={openNewTransaction}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        scopeLabel={monthLabel}
        onSelectTransaction={openEditTransaction}
      />

      {/* Budget Limit Setting Modal (key: nilai awal dibaca ulang untuk tiap kategori) */}
      <BudgetModal
        key={selectedBudgetCat?.id ?? 'none'}
        isOpen={selectedBudgetCat !== null}
        onClose={() => setSelectedBudgetCat(null)}
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
      {transactionSheet && (
        <TransactionFormSheet
          key={sheetKey}
          uid={user.uid}
          isOpen
          onClose={() => setTransactionSheet(null)}
          accounts={activeAccounts}
          categories={activeCategories}
          initialTx={transactionSheet.mode === 'edit' ? transactionSheet.tx : null}
          duplicateData={transactionSheet.mode === 'duplicate' ? transactionSheet.data : null}
          initialTransfer={transactionSheet.mode === 'transfer' ? transactionSheet.prefill : null}
          createdBy={userProfileCreator}
          ledgerId={ledgerId}
        />
      )}

      {/* Manage Accounts & Categories Sheet */}
      <ManageSheet
        uid={user.uid}
        ledgerId={ledgerId}
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

      <DeleteTransactionDialog
        transaction={txToDelete}
        accountMap={accountMap}
        categoryMap={categoryMap}
        isDeleting={isDeleting}
        onCancel={() => setTxToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Family Ledger Sheet */}
      <FamilyLedgerSheet
        isOpen={isFamilySheetOpen}
        onClose={() => setIsFamilySheetOpen(false)}
        currentUserId={user.uid}
        activeLedger={activeLedger}
        savedLedger={savedFamilyLedger}
        onSwitchToFamily={family.switchToFamily}
        onOpenJoinDialog={() => setIsJoinDialogOpen(true)}
        onSwitchToPersonal={activeLedger ? family.switchToPersonal : undefined}
        onCreateLedger={handleCreateLedger}
        isCreating={family.isCreatingLedger}
        onRotateInviteCode={family.rotateInviteCode}
      />

      {/* Join Ledger Dialog (di-mount hanya saat dibuka agar state-nya selalu bersih) */}
      {isJoinDialogOpen && (
        <JoinLedgerDialog
          key={joinCodeFromUrl}
          isOpen
          onClose={() => setIsJoinDialogOpen(false)}
          initialCode={joinCodeFromUrl}
          currentUser={family.ledgerProfile}
          onJoinSuccess={family.handleJoinSuccess}
        />
      )}
    </MobileFrame>
  );
}
