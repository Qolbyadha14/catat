import type { Account } from './schemas';

export type BillUrgency = 'overdue' | 'urgent' | 'upcoming' | 'safe';

export interface DueDateCalculation {
  daysLeft: number;
  urgency: BillUrgency;
  dueDate: Date;
}

export interface UpcomingBill {
  accountId: string;
  accountName: string;
  accountIcon?: string;
  amount: number;
  dueDay: number;
  daysLeft: number;
  urgency: BillUrgency;
}

export function calculateDueDays(dueDay: number, referenceDate: Date = new Date()): DueDateCalculation {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  const daysLeft = dueDay - currentDay;
  const dueDate = new Date(year, month, dueDay);

  let urgency: BillUrgency;
  if (daysLeft < 0) {
    urgency = 'overdue';
  } else if (daysLeft <= 3) {
    urgency = 'urgent';
  } else if (daysLeft <= 7) {
    urgency = 'upcoming';
  } else {
    urgency = 'safe';
  }

  return { daysLeft, urgency, dueDate };
}

export function getUpcomingBills(accounts: Account[], referenceDate: Date = new Date()): UpcomingBill[] {
  const result: UpcomingBill[] = [];

  for (const acc of accounts) {
    // Only liability accounts with negative balance and a specified dueDay
    if (acc.kind === 'liability' && acc.dueDay && acc.dueDay >= 1 && acc.dueDay <= 31 && acc.balance < 0) {
      const calc = calculateDueDays(acc.dueDay, referenceDate);
      result.push({
        accountId: acc.id,
        accountName: acc.name,
        accountIcon: acc.icon,
        amount: Math.abs(acc.balance),
        dueDay: acc.dueDay,
        daysLeft: calc.daysLeft,
        urgency: calc.urgency,
      });
    }
  }

  // Sort by urgency and then by days left
  const urgencyWeight: Record<BillUrgency, number> = {
    overdue: 0,
    urgent: 1,
    upcoming: 2,
    safe: 3,
  };

  return result.sort((a, b) => {
    const diff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    if (diff !== 0) return diff;
    return a.daysLeft - b.daysLeft;
  });
}
