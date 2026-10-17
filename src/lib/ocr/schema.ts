import { z } from 'zod';

export const ocrReceiptSchema = z.object({
  amount: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').nullable(),
  merchant: z.string().trim().max(100).nullable(),
  confidence: z.enum(['high', 'low']),
});

export type OcrReceiptRaw = z.infer<typeof ocrReceiptSchema>;

export interface OcrReceiptResult {
  amount: number;
  date: string;
  merchant: string | null;
  confidence: 'high' | 'low';
}

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseOcrReceipt(input: unknown, referenceDate: Date = new Date()): OcrReceiptResult {
  const parsed = ocrReceiptSchema.parse(input);
  const todayStr = toLocalDateString(referenceDate);

  let finalDate = todayStr;
  if (parsed.date) {
    const parsedTime = Date.parse(`${parsed.date}T00:00:00`);
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    if (!Number.isNaN(parsedTime) && parsedTime <= tomorrow.getTime()) {
      finalDate = parsed.date;
    }
  }

  return {
    amount: parsed.amount,
    date: finalDate,
    merchant: parsed.merchant ? parsed.merchant.trim() : null,
    confidence: parsed.confidence,
  };
}
