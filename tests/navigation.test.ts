import { describe, it, expect } from 'bun:test';
import { BottomNav, type NavTabType } from '../src/components/navigation/BottomNav';

describe('BottomNav', () => {
  it('validates BottomNav component is exported', () => {
    expect(BottomNav).toBeDefined();
    const validTabs: NavTabType[] = ['dashboard', 'accounts', 'budgets', 'stats'];
    expect(validTabs.length).toBe(4);
    expect(validTabs.includes('dashboard')).toBe(true);
  });
});

