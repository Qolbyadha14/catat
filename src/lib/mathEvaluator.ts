export interface MathEvalSuccess {
  success: true;
  value: number;
}

export interface MathEvalError {
  success: false;
  error: string;
}

export type MathEvalResult = MathEvalSuccess | MathEvalError;

/**
 * Normalizes Indonesian numbers:
 * 1. Shorthand suffixes: 150k / 150rb -> 150000, 2.5k -> 2500
 * 2. Thousand separator dots: 116.000 -> 116000, 1.500.000 -> 1500000
 * Preserves standard decimals: 0.1, 12.5
 */
export function normalizeIndonesianNumbers(text: string): string {
  // Support k / rb shorthand (e.g. 150k, 150rb, 2.5k, 2,5k)
  let res = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:rb|k)\b/gi, (_, n) => {
    const num = parseFloat(n.replace(',', '.'));
    return String(Math.round(num * 1000));
  });

  // Support Indonesian thousand dots (e.g. 116.000 -> 116000, 1.500.000 -> 1500000)
  res = res.replace(/\b(\d{1,3}(?:\.\d{3})+)(?:,(\d+))?\b/g, (_match, thousands, decimals) => {
    const stripped = thousands.replace(/\./g, '');
    return decimals ? `${stripped}.${decimals}` : stripped;
  });

  return res;
}

/**
 * Evaluates a basic arithmetic expression supporting +, -, *, / with standard operator precedence.
 * Zero dependencies, no eval() or Function().
 */
export function evaluateMathExpression(expr: string): MathEvalResult {
  if (!expr || !expr.trim()) {
    return { success: false, error: 'Ekspresi kosong' };
  }

  // Pre-normalize Indonesian currency format (thousand dots, k/rb shorthand)
  const normalized = normalizeIndonesianNumbers(expr.trim());

  // Normalize commas to dots and trim
  let cleaned = normalized.replace(/,/g, '.');

  // Ignore trailing operators and trailing whitespace (e.g. "15000+" -> "15000")
  cleaned = cleaned.replace(/[+\-*/\s]+$/, '');
  if (!cleaned) {
    return { success: false, error: 'Ekspresi tidak valid' };
  }

  // Only allow digits, operators (+, -, *, /), decimal dots, and whitespace
  if (/[^0-9+\-*/.\s]/.test(cleaned)) {
    return { success: false, error: 'Karakter tidak valid' };
  }

  // Tokenize numbers (\d+(\.\d+)?) and operators ([+\-*/])
  const tokens: (number | string)[] = [];
  const regex = /(\d+(?:\.\d+)?)|([+\-*/])/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(cleaned)) !== null) {
    const between = cleaned.slice(lastIndex, match.index).trim();
    if (between.length > 0) {
      return { success: false, error: 'Sintaks tidak valid' };
    }
    if (match[1] !== undefined) {
      const num = Number(match[1]);
      if (isNaN(num)) return { success: false, error: 'Angka tidak valid' };
      tokens.push(num);
    } else if (match[2] !== undefined) {
      tokens.push(match[2]);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    return { success: false, error: 'Sintaks tidak valid' };
  }

  if (tokens.length === 0) {
    return { success: false, error: 'Ekspresi tidak valid' };
  }

  // Tokens must alternate: number, operator, number, operator... (length must be odd: 1, 3, 5...)
  if (tokens.length % 2 === 0) {
    return { success: false, error: 'Sintaks tidak valid' };
  }

  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      if (typeof tokens[i] !== 'number') {
        return { success: false, error: 'Sintaks tidak valid' };
      }
    } else {
      if (typeof tokens[i] !== 'string') {
        return { success: false, error: 'Sintaks tidak valid' };
      }
    }
  }

  // Pass 1: Handle * and / (higher precedence, left-to-right)
  const pass1Numbers: number[] = [tokens[0] as number];
  const pass1Ops: string[] = [];

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as string;
    const nextNum = tokens[i + 1] as number;

    if (op === '*' || op === '/') {
      const prev = pass1Numbers.pop()!;
      if (op === '*') {
        pass1Numbers.push(prev * nextNum);
      } else {
        if (nextNum === 0 || Math.abs(nextNum) < 1e-12) {
          return { success: false, error: 'Pembagi nol' };
        }
        pass1Numbers.push(prev / nextNum);
      }
    } else {
      pass1Numbers.push(nextNum);
      pass1Ops.push(op);
    }
  }

  // Pass 2: Handle + and - (lower precedence, left-to-right)
  let result = pass1Numbers[0] ?? 0;
  for (let j = 0; j < pass1Ops.length; j++) {
    const op = pass1Ops[j];
    const nextNum = pass1Numbers[j + 1] ?? 0;
    if (op === '+') {
      result += nextNum;
    } else if (op === '-') {
      result -= nextNum;
    }
  }

  // Round float precision cleanly (e.g. 0.1 + 0.2 = 0.3)
  let cleanResult = parseFloat(result.toFixed(8));
  if (Object.is(cleanResult, -0)) {
    cleanResult = 0;
  }

  if (cleanResult < 0) {
    return { success: false, error: 'Hasil kalkulasi tidak boleh negatif' };
  }

  return { success: true, value: cleanResult };
}
