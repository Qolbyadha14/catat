import { z } from 'zod';
import { transactionItemSchema, type TransactionItem } from '../schemas';

export const ocrReceiptSchema = z.object({
  amount: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').nullable(),
  merchant: z.string().trim().max(100).nullable(),
  confidence: z.enum(['high', 'low']),
  categoryId: z.string().trim().nullable().optional().default(null),
  accountId: z.string().trim().nullable().optional().default(null),
  platform: z.enum(['shopeefood', 'gofood', 'spaylater', 'tiktok', 'bank_jago', 'qris', 'other']).optional().default('other'),
  paymentMethod: z.string().trim().max(50).nullable().optional().default(null),
  suggestedType: z.enum(['expense', 'transfer']).optional().default('expense'),
  transactionNumber: z.string().trim().max(100).nullable().optional().default(null),
  items: z.array(transactionItemSchema).optional().default([]),
});

export type OcrReceiptRaw = z.infer<typeof ocrReceiptSchema>;

export interface OcrReceiptResult {
  amount: number;
  date: string;
  merchant: string | null;
  confidence: 'high' | 'low';
  categoryId: string | null;
  accountId: string | null;
  platform: 'shopeefood' | 'gofood' | 'spaylater' | 'tiktok' | 'bank_jago' | 'qris' | 'other';
  paymentMethod: string | null;
  suggestedType: 'expense' | 'transfer';
  transactionNumber: string | null;
  referenceKey: string | null;
  items: TransactionItem[];
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

  const rawTxNum = parsed.transactionNumber ? parsed.transactionNumber.trim() : null;
  const platform = parsed.platform ?? 'other';
  const referenceKey = rawTxNum ? `${platform}#${rawTxNum}` : null;

  return {
    amount: parsed.amount,
    date: finalDate,
    merchant: parsed.merchant ? parsed.merchant.trim() : null,
    confidence: parsed.confidence,
    categoryId: parsed.categoryId ?? null,
    accountId: parsed.accountId ?? null,
    platform,
    paymentMethod: parsed.paymentMethod ? parsed.paymentMethod.trim() : null,
    suggestedType: parsed.suggestedType ?? 'expense',
    transactionNumber: rawTxNum,
    referenceKey,
    items: parsed.items ?? [],
  };
}
