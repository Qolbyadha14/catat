import {
  hexToRgb,
  getRelativeLuminance,
  getContrastRatio,
  passesWcagAA,
  auditColorPairs,
} from './contrastChecker';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// 1. hexToRgb & Luminance
const whiteRgb = hexToRgb('#ffffff');
assert(whiteRgb[0] === 255 && whiteRgb[1] === 255 && whiteRgb[2] === 255, 'white rgb');
const blackRgb = hexToRgb('#000000');
assert(blackRgb[0] === 0 && blackRgb[1] === 0 && blackRgb[2] === 0, 'black rgb');

const whiteLum = getRelativeLuminance(whiteRgb);
assert(Math.abs(whiteLum - 1.0) < 0.001, 'white luminance 1.0');
const blackLum = getRelativeLuminance(blackRgb);
assert(Math.abs(blackLum - 0.0) < 0.001, 'black luminance 0.0');

// 2. Contrast Ratio
const bwRatio = getContrastRatio('#ffffff', '#000000');
assert(Math.abs(bwRatio - 21.0) < 0.1, 'B/W ratio is 21:1');

// 3. Short hex
const shortHexRatio = getContrastRatio('#fff', '#000');
assert(Math.abs(shortHexRatio - 21.0) < 0.1, 'Short hex works');

// 4. WCAG AA Thresholds
assert(passesWcagAA('#000000', '#ffffff') === true, 'Black on white passes AA');
assert(passesWcagAA('#ffffff', '#000000') === true, 'White on black passes AA');
assert(passesWcagAA('#777777', '#ffffff') === false, '#777 on white fails AA normal text');

// 5. Audit color pairs
const audit = auditColorPairs([
  { label: 'Primary on white', fg: '#0f172a', bg: '#ffffff' },
  { label: 'Muted on white', fg: '#64748b', bg: '#ffffff' },
]);
assert(audit.passed === true, 'Audit pairs pass');

console.log('contrastChecker tests pass');
