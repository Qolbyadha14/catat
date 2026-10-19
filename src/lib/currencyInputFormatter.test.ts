import { formatLiveAmount, calculateNewCursorPosition } from './currencyInputFormatter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// 1. Basic pure digits formatting
{
  const r1 = formatLiveAmount('1000');
  assert(r1.formatted === '1.000', `Expected 1.000, got ${r1.formatted}`);
  assert(r1.rawNumber === 1000, `Expected 1000, got ${r1.rawNumber}`);
  assert(!r1.isExpression, 'Should not be expression');

  const r2 = formatLiveAmount('1000000');
  assert(r2.formatted === '1.000.000', `Expected 1.000.000, got ${r2.formatted}`);
  assert(r2.rawNumber === 1000000, `Expected 1000000, got ${r2.rawNumber}`);

  const r3 = formatLiveAmount('0050000');
  assert(r3.formatted === '50.000', `Expected 50.000, got ${r3.formatted}`);
  assert(r3.rawNumber === 50000, `Expected 50000, got ${r3.rawNumber}`);

  const r0 = formatLiveAmount('0');
  assert(r0.formatted === '0', `Expected 0, got ${r0.formatted}`);
  assert(r0.rawNumber === 0, `Expected 0, got ${r0.rawNumber}`);

  const rEmpty = formatLiveAmount('');
  assert(rEmpty.formatted === '', `Expected empty string, got ${rEmpty.formatted}`);
  assert(rEmpty.rawNumber === null, 'Expected null rawNumber');

  const rNonDigits = formatLiveAmount('abc');
  assert(rNonDigits.formatted === '', `Expected empty string for non-digits, got ${rNonDigits.formatted}`);
  assert(rNonDigits.rawNumber === null, 'Expected null rawNumber for non-digits');
}

// 2. Inline math expression formatting
{
  const rMath = formatLiveAmount('50000 + 25000');
  assert(rMath.formatted === '50.000 + 25.000', `Expected 50.000 + 25.000, got ${rMath.formatted}`);
  assert(rMath.isExpression === true, 'Should be expression');

  const rMathMinus = formatLiveAmount('100000 - 25000');
  assert(rMathMinus.formatted === '100.000 - 25.000', `Expected 100.000 - 25.000, got ${rMathMinus.formatted}`);

  const rShorthand = formatLiveAmount('15k + 20rb');
  assert(rShorthand.formatted === '15k + 20rb', `Expected 15k + 20rb, got ${rShorthand.formatted}`);
  assert(rShorthand.isExpression === true, 'Should be expression');

  const rSingleShorthand = formatLiveAmount('15k');
  assert(rSingleShorthand.formatted === '15k', `Expected 15k, got ${rSingleShorthand.formatted}`);
  assert(rSingleShorthand.isExpression === true, 'Should be expression');
}

// 3. Smart cursor position calculation
{
  // Appending at end: typing '0' at end of '100' -> input '1000' -> formatted '1.000'
  const cursor1 = calculateNewCursorPosition('1000', '1.000', 4);
  assert(cursor1 === 5, `Expected cursor at 5, got ${cursor1}`);

  // Typing in the middle: '10.000' -> user inserted '5' after '10' -> input '105.000' (or '105000')
  // Cursor in input was at position 3 (right after '5').
  // Non-separator chars strictly to the left of position 3 in '105000': '1', '0', '5' (3 non-separators).
  // In newText '105.000', counting 3 non-separators: '1'(1), '0'(2), '5'(3) -> index 3.
  const cursor2 = calculateNewCursorPosition('105000', '105.000', 3);
  assert(cursor2 === 3, `Expected cursor at 3, got ${cursor2}`);

  // Typing 4 digits in middle: '1.000' -> user types '2' after '1.'
  // old text with user edit: '12.000' (cursor at 2, after '2').
  // Non-separator count: '1', '2' -> 2.
  // formatted: '12.000' -> cursor should be at 2 (after '2').
  const cursor3 = calculateNewCursorPosition('12.000', '12.000', 2);
  assert(cursor3 === 2, `Expected cursor at 2, got ${cursor3}`);

  // Backspacing a dot: in '1.000' (cursor at 2). Backspace deletes dot -> '1000' with cursor at 1.
  // Non-separator count in '1000' before index 1: '1' -> 1.
  // formatted is '1.000'. Index after 1 non-separator is 1 (after '1').
  const cursor4 = calculateNewCursorPosition('1000', '1.000', 1);
  assert(cursor4 === 1, `Expected cursor at 1, got ${cursor4}`);
}

console.log('currencyInputFormatter tests pass');
