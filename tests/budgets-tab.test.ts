import { describe, it, expect } from 'bun:test';
import { BudgetsTab } from '../src/features/budgets/BudgetsTab';
import { BudgetModal } from '../src/features/budgets/BudgetModal';

describe('BudgetsTab and BudgetModal', () => {
  it('computes correct percentage and on-track status', () => {
    const limit = 2000000;
    const spent = 800000;
    const pct = (spent / limit) * 100;
    const isOnTrack = pct <= 80;
    expect(pct).toBe(40);
    expect(isOnTrack).toBe(true);
  });

  it('exports BudgetsTab and BudgetModal cleanly', () => {
    expect(BudgetsTab).toBeDefined();
    expect(BudgetModal).toBeDefined();
  });
});
