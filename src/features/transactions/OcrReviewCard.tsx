import { formatIdr } from '../../lib/formatters';
import type { OcrReceiptResult } from '../../lib/ocr/schema';

export interface OcrReviewCardProps {
  result: OcrReceiptResult;
  previewUrl: string | null;
  categoryName?: string;
  categoryIcon?: string;
  accountName?: string;
  onQuickSave: () => void;
  onEditDetails: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
}

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

export function OcrReviewCard({
  result,
  previewUrl,
  categoryName,
  categoryIcon = '📁',
  accountName,
  onQuickSave,
  onEditDetails,
  onDiscard,
  isSaving = false,
}: OcrReviewCardProps) {
  const platformLabel = formatPlatformBadge(result.platform);

  return (
    <div className="ocr-review-card" role="region" aria-label="Review Hasil Scan Struk">
      <div className="ocr-review-header">
        <div className="ocr-review-header-left">
          <span className="ocr-platform-badge">{platformLabel}</span>
          <span className={`ocr-confidence-tag ${result.confidence}`}>
            {result.confidence === 'high' ? '✓ Akurat' : '⚠️ Periksa'}
          </span>
        </div>
        <button
          type="button"
          className="btn-ocr-discard"
          onClick={onDiscard}
          title="Batal / Scan Ulang"
          aria-label="Batal / Scan Ulang"
        >
          ✕
        </button>
      </div>

      <div className="ocr-review-content">
        {previewUrl && (
          <div className="ocr-preview-thumb-wrap">
            <img src={previewUrl} alt="Preview Struk" className="ocr-preview-thumb" />
          </div>
        )}

        <div className="ocr-review-details">
          <div className="ocr-review-amount-label">Total Terdeteksi</div>
          <div className="ocr-review-amount">{formatIdr(result.amount)}</div>

          <div className="ocr-review-chips">
            {categoryName && (
              <div className="ocr-result-chip category" title="Kategori terdeteksi">
                <span>{categoryIcon}</span>
                <span>{categoryName}</span>
              </div>
            )}
            {accountName && (
              <div className="ocr-result-chip account" title="Sumber dana">
                <span>🏦</span>
                <span>{accountName}</span>
              </div>
            )}
            {result.date && (
              <div className="ocr-result-chip date" title="Tanggal transaksi">
                <span>📅</span>
                <span>{result.date}</span>
              </div>
            )}
          </div>

          {result.merchant && (
            <div className="ocr-review-merchant">
              <strong>Toko:</strong> {result.merchant}
              {result.paymentMethod && ` • via ${result.paymentMethod}`}
            </div>
          )}
        </div>
      </div>

      <div className="ocr-review-actions">
        <button
          type="button"
          className="btn-ocr-quick-save"
          onClick={onQuickSave}
          disabled={isSaving}
        >
          {isSaving ? 'Menyimpan Transaksi...' : 'Simpan Transaksi'}
        </button>
        <button
          type="button"
          className="btn-ocr-edit-details"
          onClick={onEditDetails}
          disabled={isSaving}
        >
          Sesuaikan Detail
        </button>
      </div>
    </div>
  );
}
