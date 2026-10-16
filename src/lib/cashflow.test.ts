import { calculateNetCashflow } from './cashflow';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// Case 1: Surplus
{
  const res = calculateNetCashflow(150000, 50000);
  assert(res.net === 100000, 'net must be 100000');
  assert(res.isSurplus === true, 'isSurplus must be true');
  assert(res.formatted.startsWith('+'), 'formatted must start with +');
  assert(res.formatted.includes('100.000'), 'formatted must contain 100.000');
}

// Case 2: Defisit besar
{
  const res = calculateNetCashflow(20000, 850000);
  assert(res.net === -830000, 'net must be -830000');
  assert(res.isSurplus === false, 'isSurplus must be false');
  assert(res.formatted.startsWith('-'), 'formatted must start with -');
  assert(!res.formatted.startsWith('--'), 'formatted must not have double minus');
  assert(res.formatted.includes('830.000'), 'formatted must contain 830.000');
}

// Case 3: Zero edge case (net = 0 treated as surplus hijau '+')
{
  const res = calculateNetCashflow(50000, 50000);
  assert(res.net === 0, 'net must be 0');
  assert(res.isSurplus === true, 'isSurplus must be true');
  assert(res.formatted.startsWith('+'), 'formatted must start with +');
  assert(res.formatted.includes('0'), 'formatted must contain 0');
}

console.log('Net cashflow tests pass');
