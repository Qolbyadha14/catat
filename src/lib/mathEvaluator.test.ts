import { evaluateMathExpression } from './mathEvaluator';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// 1. Single valid numbers & decimals
{
  const res1 = evaluateMathExpression('15000');
  assert(res1.success === true && res1.value === 15000, 'Single integer should evaluate to 15000');

  const res2 = evaluateMathExpression('12.5');
  assert(res2.success === true && res2.value === 12.5, 'Single decimal should evaluate to 12.5');

  const res3 = evaluateMathExpression('0');
  assert(res3.success === true && res3.value === 0, 'Zero should evaluate to 0');
}

// 2. Operator precedence (* and / evaluated before + and -)
{
  const res1 = evaluateMathExpression('2+3*4');
  assert(res1.success === true && res1.value === 14, `2+3*4 must be 14 (precedence), got: ${res1.success ? res1.value : res1.error}`);

  const res2 = evaluateMathExpression('2*3+4');
  assert(res2.success === true && res2.value === 10, '2*3+4 must be 10');

  const res3 = evaluateMathExpression('10-2*3');
  assert(res3.success === true && res3.value === 4, '10-2*3 must be 4');

  const res4 = evaluateMathExpression('10/2+3');
  assert(res4.success === true && res4.value === 8, '10/2+3 must be 8');

  const res5 = evaluateMathExpression('15000+25000*2');
  assert(res5.success === true && res5.value === 65000, '15000+25000*2 must be 65000');

  // Left-to-right evaluation for same precedence
  const res6 = evaluateMathExpression('20/4*2');
  assert(res6.success === true && res6.value === 10, '20/4*2 must be 10 (left to right)');

  const res7 = evaluateMathExpression('10-5-2');
  assert(res7.success === true && res7.value === 3, '10-5-2 must be 3 (left to right)');
}

// 3. Trailing operators ignored (graceful fallback)
{
  const res1 = evaluateMathExpression('15000+');
  assert(res1.success === true && res1.value === 15000, 'Trailing + should be ignored');

  const res2 = evaluateMathExpression('15000-');
  assert(res2.success === true && res2.value === 15000, 'Trailing - should be ignored');

  const res3 = evaluateMathExpression('15000*');
  assert(res3.success === true && res3.value === 15000, 'Trailing * should be ignored');

  const res4 = evaluateMathExpression('15000/');
  assert(res4.success === true && res4.value === 15000, 'Trailing / should be ignored');

  const res5 = evaluateMathExpression('15000 + - *  ');
  assert(res5.success === true && res5.value === 15000, 'Multiple trailing operators with whitespace ignored');

  const res6 = evaluateMathExpression('+');
  assert(res6.success === false && res6.error === 'Ekspresi tidak valid', 'Lone operator must fail');
}

// 4. Division by zero safe guard
{
  const res1 = evaluateMathExpression('10/0');
  assert(res1.success === false && res1.error === 'Pembagi nol', 'Division by 0 must return "Pembagi nol"');

  const res2 = evaluateMathExpression('10 / 0.0');
  assert(res2.success === false && res2.error === 'Pembagi nol', 'Division by 0.0 must return "Pembagi nol"');
}

// 5. Float precision & comma normalization
{
  const res1 = evaluateMathExpression('0.1 + 0.2');
  assert(res1.success === true && res1.value === 0.3, `0.1 + 0.2 must be 0.3 cleanly, got: ${res1.success ? res1.value : res1.error}`);

  const res2 = evaluateMathExpression('2,5 * 1000');
  assert(res2.success === true && res2.value === 2500, 'Comma should be normalized to decimal point');
}

// 6. Block negative results
{
  const res = evaluateMathExpression('10 - 50');
  assert(res.success === false && res.error === 'Hasil kalkulasi tidak boleh negatif', 'Negative results must be blocked');
}

// 7. Invalid syntax & safe error handling
{
  const res1 = evaluateMathExpression('');
  assert(res1.success === false && res1.error === 'Ekspresi kosong', 'Empty string must return "Ekspresi kosong"');

  const res2 = evaluateMathExpression('   ');
  assert(res2.success === false && res2.error === 'Ekspresi kosong', 'Whitespace string must return "Ekspresi kosong"');

  const res3 = evaluateMathExpression('abc');
  assert(res3.success === false && res3.error === 'Karakter tidak valid', 'Letters must return "Karakter tidak valid"');

  const res4 = evaluateMathExpression('15000 * * 2');
  assert(res4.success === false && res4.error === 'Sintaks tidak valid', 'Consecutive operators must return "Sintaks tidak valid"');

  const res5 = evaluateMathExpression('(2+3)*4');
  assert(res5.success === false && res5.error === 'Karakter tidak valid', 'Parentheses must be rejected cleanly');
}

console.log('Math evaluator asserts pass');
