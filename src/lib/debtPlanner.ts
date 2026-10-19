import type { Account } from './schemas';

export type DebtStrategy = 'snowball' | 'avalanche';

export interface DebtPlanItem {
  accountId: string;
  name: string;
  icon?: string;
  remainingDebt: number;
  payoffMonths: number;
  payoffDate: Date;
  payoffDateLabel: string;
  isCurrentFocus: boolean;
}

export interface DebtPlanResult {
  totalDebt: number;
  monthlyAllocation: number;
  strategy: DebtStrategy;
  totalMonths: number;
  debtFreeDate: Date | null;
  debtFreeDateLabel: string;
  items: DebtPlanItem[];
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function getLiabilityAccountsWithDebt(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.kind === 'liability' && a.balance < 0 && !a.isArchived);
}

function getAvalancheWeight(name: string): number {
  const lower = name.toLowerCase();
  // Highest priority (penalty/interest weight): PayLater (SPayLater, TikTok) & KTA loans
  if (lower.includes('paylater') || lower.includes('spaylater') || lower.includes('tiktok')) {
    return 100;
  }
  if (lower.includes('kta') || lower.includes('pinjaman') || lower.includes('cicilan')) {
    return 90;
  }
  if (lower.includes('cc') || lower.includes('kartu kredit')) {
    return 80;
  }
  return 50;
}

export function sortDebtsByStrategy(debts: Account[], strategy: DebtStrategy): Account[] {
  const copy = [...debts];
  if (strategy === 'snowball') {
    // Smallest nominal debt first
    return copy.sort((a, b) => Math.abs(a.balance) - Math.abs(b.balance));
  }

  // Avalanche: Prioritize high-penalty types, then largest balance within same tier
  return copy.sort((a, b) => {
    const weightDiff = getAvalancheWeight(b.name) - getAvalancheWeight(a.name);
    if (weightDiff !== 0) return weightDiff;
    return Math.abs(b.balance) - Math.abs(a.balance);
  });
}

export function calculateDebtPlan(
  accounts: Account[],
  monthlyAllocation: number,
  strategy: DebtStrategy,
  startDate: Date = new Date()
): DebtPlanResult {
  const activeDebts = getLiabilityAccountsWithDebt(accounts);
  const totalDebt = activeDebts.reduce((sum, a) => sum + Math.abs(a.balance), 0);

  if (activeDebts.length === 0 || totalDebt === 0) {
    return {
      totalDebt: 0,
      monthlyAllocation,
      strategy,
      totalMonths: 0,
      debtFreeDate: null,
      debtFreeDateLabel: 'Bebas Hutang',
      items: [],
    };
  }

  const effectiveAllocation = monthlyAllocation > 0 ? monthlyAllocation : 500000;
  const sorted = sortDebtsByStrategy(activeDebts, strategy);

  let cumulativeDebt = 0;
  const items: DebtPlanItem[] = sorted.map((acc, index) => {
    const debt = Math.abs(acc.balance);
    cumulativeDebt += debt;

    const monthsNeeded = Math.max(1, Math.ceil(cumulativeDebt / effectiveAllocation));
    const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthsNeeded, 1);
    const dateLabel = `${MONTH_NAMES[targetDate.getMonth()]} ${targetDate.getFullYear()} (${monthsNeeded} bln)`;

    return {
      accountId: acc.id,
      name: acc.name,
      icon: acc.icon,
      remainingDebt: debt,
      payoffMonths: monthsNeeded,
      payoffDate: targetDate,
      payoffDateLabel: dateLabel,
      isCurrentFocus: index === 0,
    };
  });

  const totalMonths = Math.max(1, Math.ceil(totalDebt / effectiveAllocation));
  const debtFreeDate = new Date(startDate.getFullYear(), startDate.getMonth() + totalMonths, 1);
  const debtFreeDateLabel = `${MONTH_NAMES[debtFreeDate.getMonth()]} ${debtFreeDate.getFullYear()} (${totalMonths} Bulan)`;

  return {
    totalDebt,
    monthlyAllocation: effectiveAllocation,
    strategy,
    totalMonths,
    debtFreeDate,
    debtFreeDateLabel,
    items,
  };
}
