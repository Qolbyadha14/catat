import { describe, it, expect } from 'bun:test';
import { BalanceHeroCard } from '../src/features/dashboard/BalanceHeroCard';
import { HomeTab } from '../src/features/dashboard/HomeTab';

describe('BalanceHeroCard and HomeTab', () => {
  it('exports BalanceHeroCard and HomeTab cleanly', () => {
    expect(BalanceHeroCard).toBeDefined();
    expect(HomeTab).toBeDefined();
  });
});

