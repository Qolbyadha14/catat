import type { OcrReceiptResult } from '../../lib/ocr/schema';

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

export function calculateBatchTotal(items: BatchReviewItem[]): number {
  return items.reduce((sum, item) => (item.isExcluded ? sum : sum + (item.nominal || 0)), 0);
}
