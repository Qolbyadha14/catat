import type { OcrReceiptResult } from '../../lib/ocr/schema';

export function formatPlatformBadge(platform: OcrReceiptResult['platform']): string {
  switch (platform) {
    case 'shopeefood':
      return 'ShopeeFood';
    case 'gofood':
      return 'GoFood';
    case 'spaylater':
      return 'SPayLater';
    case 'tiktok':
      return 'TikTok';
    case 'bank_jago':
      return 'Bank Jago';
    case 'qris':
      return 'QRIS';
    case 'other':
    default:
      return 'Struk Belanja';
  }
}

export function formatReviewNote(
  merchant: string | null,
  paymentMethod: string | null,
  platform: OcrReceiptResult['platform']
): string {
  const parts: string[] = [];
  const platformName = formatPlatformBadge(platform);

  if (merchant) {
    parts.push(merchant);
  } else {
    parts.push(platformName);
  }

  const extras: string[] = [];
  if (platform !== 'other' && merchant) {
    extras.push(platformName);
  }
  if (paymentMethod && !extras.includes(paymentMethod)) {
    extras.push(paymentMethod);
  }

  if (extras.length > 0) {
    return `${parts.join(' ')} (${extras.join(' - ')})`;
  }
  return parts.join(' ');
}
