/**
 * Real-time IDR currency input formatter with smart cursor tracking.
 */

export interface FormatLiveAmountResult {
  formatted: string;
  rawNumber: number | null;
  isExpression: boolean;
}

const MATH_OPERATORS = /[+\-*/]/;
const SHORTHAND_UNITS = /[kK]|rb|RB|Rb|rB/;

/**
 * Format raw numbers with dot thousand separator.
 */
function formatIntegerString(digits: string): string {
  // Trim leading zeroes unless the string is just '0'
  const trimmed = digits.replace(/^0+(?=\d)/, '');
  if (!trimmed) return '0';
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formats user input in real-time.
 * - Handles pure numbers: '1000000' -> '1.000.000'
 * - Handles math expressions: '50000 + 25000' -> '50.000 + 25.000'
 * - Preserves shorthand: '15k', '20rb'
 */
export function formatLiveAmount(input: string): FormatLiveAmountResult {
  if (!input || !input.trim()) {
    return { formatted: '', rawNumber: null, isExpression: false };
  }

  // Check if it's an expression or has shorthand units
  const hasOperator = MATH_OPERATORS.test(input);
  const hasShorthand = SHORTHAND_UNITS.test(input);

  if (hasOperator || hasShorthand) {
    // Format numeric chunks within expression while preserving operators, units, and spaces
    const formatted = input.replace(/\d+/g, (match) => {
      // Remove any inner dots from match if any
      const cleaned = match.replace(/\./g, '');
      return formatIntegerString(cleaned);
    });

    return {
      formatted,
      rawNumber: null,
      isExpression: true,
    };
  }

  // Pure numeric input: strip any non-digit characters
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) {
    return { formatted: '', rawNumber: null, isExpression: false };
  }

  const formatted = formatIntegerString(digitsOnly);
  const rawNumber = parseInt(digitsOnly, 10);

  return {
    formatted,
    rawNumber: Number.isNaN(rawNumber) ? null : rawNumber,
    isExpression: false,
  };
}

/**
 * Computes the new cursor position after formatting so that the cursor stays
 * at the same logical position relative to non-separator characters.
 */
export function calculateNewCursorPosition(
  oldText: string,
  newText: string,
  oldCursor: number
): number {
  // Count non-separator characters strictly to the left of oldCursor
  let nonSepCount = 0;
  for (let i = 0; i < oldCursor && i < oldText.length; i++) {
    if (oldText[i] !== '.') {
      nonSepCount++;
    }
  }

  // If there were no non-separators to the left, cursor should stay at 0
  if (nonSepCount === 0) {
    return 0;
  }

  // Traverse newText until we find the exact same number of non-separator characters
  let newCursor = 0;
  let seenNonSep = 0;
  while (newCursor < newText.length && seenNonSep < nonSepCount) {
    if (newText[newCursor] !== '.') {
      seenNonSep++;
    }
    newCursor++;
  }

  return newCursor;
}
