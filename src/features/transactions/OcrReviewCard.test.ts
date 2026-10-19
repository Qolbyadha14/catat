import { formatPlatformBadge, formatReviewNote } from './OcrReviewCard';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: formatPlatformBadge
assert(formatPlatformBadge('shopeefood') === 'ShopeeFood', 'formats shopeefood badge');
assert(formatPlatformBadge('bank_jago') === 'Bank Jago', 'formats bank_jago badge');
assert(formatPlatformBadge('spaylater') === 'SPayLater', 'formats spaylater badge');
assert(formatPlatformBadge('gofood') === 'GoFood', 'formats gofood badge');
assert(formatPlatformBadge('tiktok') === 'TikTok', 'formats tiktok badge');
assert(formatPlatformBadge('qris') === 'QRIS', 'formats qris badge');
assert(formatPlatformBadge('other') === 'Struk Belanja', 'formats other badge');

// Test 2: formatReviewNote
const note1 = formatReviewNote('Kopi Kenangan', 'ShopeePay', 'shopeefood');
assert(note1.includes('Kopi Kenangan'), 'includes merchant');
assert(note1.includes('ShopeeFood'), 'includes platform');
assert(note1.includes('ShopeePay'), 'includes payment method');

const note2 = formatReviewNote(null, null, 'bank_jago');
assert(note2.includes('Bank Jago'), 'handles empty merchant gracefully');

console.log('OcrReviewCard logic tests pass');
