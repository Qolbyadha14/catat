import {
  computeCategoryBudget,
  getDaysRemainingInMonth,
  evaluateTransactionBudgetImpact,
} from './budgeting';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// 1. getDaysRemainingInMonth
// On Oct 19, in a 31-day month, days remaining is: 31 - 19 + 1 = 13 days
const oct19 = new Date(2026, 9, 19); // month index 9 is October
const daysLeft = getDaysRemainingInMonth(oct19);
assert(daysLeft === 13, `getDaysRemainingInMonth expects 13, got ${daysLeft}`);

// On the last day of the month (Oct 31)
const oct31 = new Date(2026, 9, 31);
const lastDayLeft = getDaysRemainingInMonth(oct31);
assert(lastDayLeft === 1, `getDaysRemainingInMonth expects 1 on last day, got ${lastDayLeft}`);

// 2. computeCategoryBudget: Safe status (< 75%)
// Budget: 3.000.000, Spent: 1.500.000 (50%), 13 days left -> remaining: 1.500.000, daily pace: 115384
const safeRes = computeCategoryBudget(1500000, 3000000, oct19);
assert(safeRes.status === 'safe', 'status is safe');
assert(safeRes.percentage === 50, 'percentage is 50');
assert(safeRes.remaining === 1500000, 'remaining is 1500000');
assert(safeRes.overbudgetAmount === 0, 'overbudget is 0');
assert(safeRes.safeDailyPace === Math.floor(1500000 / 13), 'safeDailyPace is remaining/13');

// 3. computeCategoryBudget: Warning status (75% - 99%)
// Budget: 2.000.000, Spent: 1.600.000 (80%)
const warnRes = computeCategoryBudget(1600000, 2000000, oct19);
assert(warnRes.status === 'warning', 'status is warning');
assert(warnRes.percentage === 80, 'percentage is 80');
assert(warnRes.remaining === 400000, 'remaining is 400000');
assert(warnRes.overbudgetAmount === 0, 'overbudget is 0');

// 4. computeCategoryBudget: Exceeded status (>= 100%)
// Budget: 1.000.000, Spent: 1.200.000 (120%)
const excRes = computeCategoryBudget(1200000, 1000000, oct19);
assert(excRes.status === 'exceeded', 'status is exceeded');
assert(excRes.percentage === 120, 'percentage is 120');
assert(excRes.remaining === 0, 'remaining is 0');
assert(excRes.overbudgetAmount === 200000, 'overbudget is 200000');
assert(excRes.safeDailyPace === 0, 'safeDailyPace is 0 when exceeded');

// 5. evaluateTransactionBudgetImpact
// Monthly budget 2.000.000, current spent 1.800.000
// New transaction 150.000 -> total 1.950.000 (does not exceed, remainingAfter 50.000)
const impact1 = evaluateTransactionBudgetImpact(2000000, 1800000, 150000);
assert(impact1.willExceed === false, 'impact1 will not exceed');
assert(impact1.remainingAfter === 50000, 'impact1 remainingAfter 50000');
assert(impact1.overbudgetAmount === 0, 'impact1 overbudget 0');

// New transaction 300.000 -> total 2.100.000 (exceeds by 100.000)
const impact2 = evaluateTransactionBudgetImpact(2000000, 1800000, 300000);
assert(impact2.willExceed === true, 'impact2 will exceed');
assert(impact2.remainingAfter === 0, 'impact2 remainingAfter 0');
assert(impact2.overbudgetAmount === 100000, 'impact2 overbudget 100000');

// No monthly budget defined -> will never exceed
const impactNoBudget = evaluateTransactionBudgetImpact(undefined, 500000, 1000000);
assert(impactNoBudget.willExceed === false, 'undefined budget will not exceed');

console.log('budgeting domain logic tests passed');
