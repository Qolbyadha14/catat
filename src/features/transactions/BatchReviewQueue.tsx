import { useState } from 'react';
import type { Category, Account } from '../../lib/schemas';
import type { OcrReceiptResult } from '../../lib/ocr/schema';
import { formatIdr } from '../../lib/formatters';
import { evaluateMathExpression } from '../../lib/mathEvaluator';

export interface BatchReviewItem {
  id: string;
  previewUrl: string;
  result: OcrReceiptResult;
  nominal: number;
  nominalInput: string;
  categoryId: string;
  accountId: string;
  merchant: string;
  date: string;
  isExcluded: boolean;
}

export interface BatchReviewQueueProps {
  items: BatchReviewItem[];
  categories: Category[];
  accounts: Account[];
  onUpdateItem: (id: string, updates: Partial<BatchReviewItem>) => void;
  onRemoveItem: (id: string) => void;
  onSaveAll: () => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function calculateBatchTotal(items: BatchReviewItem[]): number {
  return items.reduce((sum, item) => (item.isExcluded ? sum : sum + (item.nominal || 0)), 0);
}

export function BatchReviewQueue({
  items,
  categories,
  accounts,
  onUpdateItem,
  onRemoveItem,
  onSaveAll,
  onCancel,
  isSaving,
}: BatchReviewQueueProps) {
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const activeItems = items.filter((it) => !it.isExcluded);
  const totalNominal = calculateBatchTotal(items);

  const handleNominalBlur = (id: string, text: string) => {
    if (!text.trim()) {
      onUpdateItem(id, { nominal: 0, nominalInput: '0' });
      return;
    }
    const evalRes = evaluateMathExpression(text);
    if (evalRes.success) {
      const rounded = Math.round(evalRes.value);
      onUpdateItem(id, {
        nominal: rounded,
        nominalInput: new Intl.NumberFormat('id-ID').format(rounded),
      });
    }
  };

  const handleNominalFocus = (id: string, nominal: number) => {
    onUpdateItem(id, { nominalInput: String(nominal) });
  };

  const getPlatformLabel = (platform: string): string => {
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
      default:
        return 'Struk';
    }
  };

  return (
    <div className="batch-review-queue">
      <div className="batch-review-header">
        <div>
          <h4 className="batch-review-title">Hasil Scan Struk ({items.length})</h4>
          <p className="batch-review-sub">
            {activeItems.length} dari {items.length} transaksi dipilih • Total:{' '}
            <strong>{formatIdr(totalNominal)}</strong>
          </p>
        </div>
      </div>

      <div className="batch-review-list">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`batch-review-card ${item.isExcluded ? 'excluded' : ''}`}
          >
            <div className="batch-card-top">
              <label className="batch-checkbox-wrap" title="Pilih transaksi untuk disimpan">
                <input
                  type="checkbox"
                  checked={!item.isExcluded}
                  onChange={(e) => onUpdateItem(item.id, { isExcluded: !e.target.checked })}
                />
                <span className="batch-card-idx">#{idx + 1}</span>
              </label>

              <div className="batch-card-tags">
                <span className="ocr-platform-badge">
                  {getPlatformLabel(item.result.platform)}
                </span>
                <span
                  className={`ocr-confidence-tag ${
                    item.result.confidence === 'high' ? 'high' : 'low'
                  }`}
                >
                  {item.result.confidence === 'high' ? 'Akurat' : 'Periksa'}
                </span>
              </div>

              <button
                type="button"
                className="btn-batch-remove"
                onClick={() => onRemoveItem(item.id)}
                title="Hapus struk dari daftar"
                aria-label="Hapus struk"
              >
                ✕
              </button>
            </div>

            <div className="batch-card-body">
              {item.previewUrl && (
                <div
                  className="batch-card-thumbnail"
                  onClick={() => setSelectedPreview(item.previewUrl)}
                  title="Klik untuk memperbesar struk"
                >
                  <img src={item.previewUrl} alt="Thumbnail struk" />
                </div>
              )}

              <div className="batch-card-inputs">
                <div className="batch-input-row">
                  <div className="batch-input-col flex-2">
                    <label className="batch-mini-label">Merchant / Toko</label>
                    <input
                      type="text"
                      className="form-input batch-field"
                      value={item.merchant}
                      onChange={(e) => onUpdateItem(item.id, { merchant: e.target.value })}
                      placeholder="Nama toko / penerima"
                    />
                  </div>
                  <div className="batch-input-col flex-1">
                    <label className="batch-mini-label">Tanggal</label>
                    <input
                      type="date"
                      className="form-input batch-field"
                      value={item.date}
                      onChange={(e) => onUpdateItem(item.id, { date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="batch-input-row">
                  <div className="batch-input-col flex-1">
                    <label className="batch-mini-label">Nominal (Rp)</label>
                    <input
                      type="text"
                      className="form-input batch-field font-semibold"
                      value={item.nominalInput}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          nominalInput: e.target.value.replace(/[^0-9+\-*/.,kKrRbB\s]/g, ''),
                        })
                      }
                      onFocus={() => handleNominalFocus(item.id, item.nominal)}
                      onBlur={() => handleNominalBlur(item.id, item.nominalInput)}
                      placeholder="0"
                    />
                  </div>

                  <div className="batch-input-col flex-1">
                    <label className="batch-mini-label">Kategori</label>
                    <select
                      className="form-input batch-field"
                      value={item.categoryId}
                      onChange={(e) => onUpdateItem(item.id, { categoryId: e.target.value })}
                    >
                      <option value="">Pilih Kategori</option>
                      {categories
                        .filter((c) => !c.isArchived)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="batch-input-col flex-1">
                    <label className="batch-mini-label">Akun Pembayaran</label>
                    <select
                      className="form-input batch-field"
                      value={item.accountId}
                      onChange={(e) => onUpdateItem(item.id, { accountId: e.target.value })}
                    >
                      <option value="">Pilih Akun</option>
                      {accounts
                        .filter((a) => !a.isArchived)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.kind === 'liability' ? 'PayLater' : 'Kas'})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="batch-review-footer">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Batal
        </button>
        <button
          type="button"
          className="btn-primary btn-save-batch"
          onClick={onSaveAll}
          disabled={isSaving || activeItems.length === 0}
        >
          {isSaving
            ? 'Menyimpan...'
            : `Simpan Semua (${activeItems.length} Transaksi)`}
        </button>
      </div>

      {selectedPreview && (
        <div className="modal-backdrop" onClick={() => setSelectedPreview(null)}>
          <div className="modal-preview-dialog" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPreview} alt="Preview Struk Penuh" className="preview-full-img" />
            <button
              type="button"
              className="btn-close-preview"
              onClick={() => setSelectedPreview(null)}
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
