/**
 * Contrast & WCAG 2.1 AA Compliance Utility
 */

export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function getRelativeLuminance(rgb: [number, number, number]): number {
  const rRaw = rgb[0] ?? 0;
  const gRaw = rgb[1] ?? 0;
  const bRaw = rgb[2] ?? 0;
  const toLinear = (val: number) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rRaw) + 0.7152 * toLinear(gRaw) + 0.0722 * toLinear(bRaw);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(hex1));
  const lum2 = getRelativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function passesWcagAA(fg: string, bg: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(fg, bg);
  const minRatio = isLargeText ? 3.0 : 4.5;
  return ratio >= minRatio;
}

export interface ContrastAuditResult {
  pair: string;
  fg: string;
  bg: string;
  ratio: number;
  minRatio: number;
  passed: boolean;
}

export function auditColorPairs(
  pairs: Array<{ label: string; fg: string; bg: string; isLargeText?: boolean }>
): { passed: boolean; results: ContrastAuditResult[] } {
  const results: ContrastAuditResult[] = pairs.map(({ label, fg, bg, isLargeText }) => {
    const ratio = getContrastRatio(fg, bg);
    const minRatio = isLargeText ? 3.0 : 4.5;
    return {
      pair: label,
      fg,
      bg,
      ratio: Math.round(ratio * 100) / 100,
      minRatio,
      passed: ratio >= minRatio,
    };
  });

  const passed = results.every((r) => r.passed);
  return { passed, results };
}
