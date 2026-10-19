import { adjustAccountBalance } from './accountService';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// 1. Helper logic for computing initial balance based on kind
export function computeInitialBalance(kind: 'asset' | 'liability', inputAmount: number): number {
  if (kind === 'liability') {
    return -Math.abs(inputAmount);
  }
  return Math.abs(inputAmount);
}

assert(computeInitialBalance('liability', 5000000) === -5000000, 'Liability balance must be negative');
assert(computeInitialBalance('liability', 0) === 0, 'Zero liability balance must be 0');
assert(computeInitialBalance('asset', 2000000) === 2000000, 'Asset balance must be positive');
assert(computeInitialBalance('asset', 0) === 0, 'Zero asset balance must be 0');

// 2. Test adjustAccountBalance function signature
assert(typeof adjustAccountBalance === 'function', 'adjustAccountBalance must be a function');

console.log('accountInitialBalance tests passed');
