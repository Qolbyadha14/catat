import { calculateDueDays, getUpcomingBills } from './bills';
import type { Account } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Reference date: 19 October 2026
const refDate = new Date(2026, 9, 19); // month index 9 = October

// 1. Due date in current month (25th) -> 6 days left
const due25 = calculateDueDays(25, refDate);
assert(due25.daysLeft === 6, 'Due on 25th should be 6 days left from 19th');
assert(due25.urgency === 'upcoming', '6 days left should be upcoming');

// 2. Due date in 2 days (21st) -> urgent
const due21 = calculateDueDays(21, refDate);
assert(due21.daysLeft === 2, 'Due on 21st should be 2 days left');
assert(due21.urgency === 'urgent', '2 days left should be urgent');

// 3. Due date today (19th) -> urgent (0 days left)
const due19 = calculateDueDays(19, refDate);
assert(due19.daysLeft === 0, 'Due today should be 0 days left');
assert(due19.urgency === 'urgent', '0 days left should be urgent');

// 4. Past due day in current month (e.g. 15th):
// If the account has an outstanding balance, it is overdue
const due15 = calculateDueDays(15, refDate);
assert(due15.daysLeft < 0, '15th from 19th should be negative days left in current month');
assert(due15.urgency === 'overdue', 'Negative days left should be overdue');

// 5. getUpcomingBills filters liability accounts with negative balance and dueDay
const accounts: Account[] = [
  {
    id: 'spaylater',
    name: 'SPayLater',
    kind: 'liability',
    balance: -450000,
    dueDay: 25,
    isArchived: false,
    createdAt: Date.now(),
  },
  {
    id: 'bca',
    name: 'BCA',
    kind: 'asset',
    balance: 5000000,
    isArchived: false,
    createdAt: Date.now(),
  },
  {
    id: 'gopaylater',
    name: 'GoPay Later',
    kind: 'liability',
    balance: 0, // No bill
    dueDay: 20,
    isArchived: false,
    createdAt: Date.now(),
  },
];

const upcoming = getUpcomingBills(accounts, refDate);
assert(upcoming.length === 1, 'Only accounts with outstanding liability should be returned');
const firstBill = upcoming[0];
assert(Boolean(firstBill), 'First bill exists');
if (firstBill) {
  assert(firstBill.accountId === 'spaylater', 'Account ID should match');
  assert(firstBill.amount === 450000, 'Bill amount should be 450000');
  assert(firstBill.daysLeft === 6, 'Days left should be 6');
}

console.log('bills domain logic unit tests passed');
