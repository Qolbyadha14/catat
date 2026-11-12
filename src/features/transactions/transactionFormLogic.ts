import type { Account, Category, Creator, Transaction, TransactionItem } from '../../lib/schemas';
import type { OcrReceiptResult } from '../../lib/ocr/schema';
import type { CreateTransactionInput } from './transactionService';
import type { BatchReviewItem } from './batchReview';

export type FormTransactionType = 'expense' | 'income' | 'transfer';

/**
 * Menentukan kategori dan akun dari hasil OCR. Urutan prioritas:
 * 1. ID dari AI (bila masih ada di daftar pengguna)
 * 2. Tebakan dari platform (ShopeeFood/GoFood → kategori makan; SPayLater/Jago → akun yang cocok)
 * 3. Metode pembayaran yang tertulis di struk
 * 4. Kategori pengeluaran / akun aktif pertama
 */
export function resolveCategoryAndAccount(
  res: Pick<OcrReceiptResult, 'categoryId' | 'accountId' | 'platform' | 'paymentMethod'>,
  categories: Category[],
  accounts: Account[]
): { matchedCatId: string; matchedAccId: string } {
  let matchedCatId = res.categoryId;
  if (matchedCatId && !categories.some((c) => c.id === matchedCatId)) {
    matchedCatId = null;
  }
  if (!matchedCatId && (res.platform === 'shopeefood' || res.platform === 'gofood')) {
    const foodCat = categories.find(
      (c) => !c.isArchived && c.type === 'expense' && /makan|minum|food|kuliner/i.test(c.name)
    );
    if (foodCat) matchedCatId = foodCat.id;
  }
  if (!matchedCatId) {
    matchedCatId = categories.find((c) => !c.isArchived && c.type === 'expense')?.id ?? '';
  }

  let matchedAccId = res.accountId;
  if (matchedAccId && !accounts.some((a) => a.id === matchedAccId)) {
    matchedAccId = null;
  }
  if (!matchedAccId) {
    if (res.platform === 'spaylater') {
      const spayAcc = accounts.find((a) => !a.isArchived && /spay|shopee.*paylater|paylater/i.test(a.name));
      if (spayAcc) matchedAccId = spayAcc.id;
    } else if (res.platform === 'bank_jago') {
      const jagoAcc = accounts.find((a) => !a.isArchived && /jago/i.test(a.name));
      if (jagoAcc) matchedAccId = jagoAcc.id;
    }
  }
  if (!matchedAccId && res.paymentMethod) {
    const pm = res.paymentMethod.toLowerCase();
    const found = accounts.find(
      (a) => !a.isArchived && (a.name.toLowerCase().includes(pm) || pm.includes(a.name.toLowerCase()))
    );
    if (found) matchedAccId = found.id;
  }
  if (!matchedAccId) {
    matchedAccId = accounts.find((a) => !a.isArchived)?.id ?? accounts[0]?.id ?? '';
  }

  return { matchedCatId, matchedAccId };
}

export interface TransactionPayloadInput {
  type: FormTransactionType;
  /** Nominal bulat dalam rupiah. */
  amount: number;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  /** Epoch ms. */
  date: number;
  note: string;
  referenceKey?: string | null;
  items?: TransactionItem[];
  createdBy?: Creator;
}

export type PayloadResult =
  | { ok: true; payload: CreateTransactionInput }
  | { ok: false; error: string };

/** Memvalidasi isian form dan membentuk payload createTransaction/updateTransaction. */
export function buildTransactionPayload(input: TransactionPayloadInput): PayloadResult {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Masukkan nominal yang valid' };
  }
  if (!input.accountId) {
    return { ok: false, error: 'Pilih akun transaksi' };
  }

  const common = {
    amount: input.amount,
    date: input.date,
    note: input.note,
    referenceKey: input.referenceKey,
    items: input.items,
    createdBy: input.createdBy,
  };

  if (input.type === 'transfer') {
    if (!input.toAccountId || input.toAccountId === input.accountId) {
      return { ok: false, error: 'Pilih akun tujuan transfer yang berbeda' };
    }
    return {
      ok: true,
      payload: { type: 'transfer', fromAccountId: input.accountId, toAccountId: input.toAccountId, ...common },
    };
  }

  if (!input.categoryId) {
    return { ok: false, error: 'Pilih kategori transaksi' };
  }
  return {
    ok: true,
    payload: { type: input.type, accountId: input.accountId, categoryId: input.categoryId, ...common },
  };
}

/** Payload simpan manual: catatan dirapikan, metadata transaksi lama dipertahankan saat mengedit. */
export function buildSubmitPayload(
  input: Omit<TransactionPayloadInput, 'items' | 'referenceKey' | 'createdBy'> & {
    items: TransactionItem[];
    referenceKey: string | null | undefined;
    createdBy?: Creator;
    initialTx?: Transaction | null;
  }
): PayloadResult {
  const { initialTx, items, referenceKey, createdBy, ...rest } = input;
  return buildTransactionPayload({
    ...rest,
    note: rest.note.trim(),
    referenceKey: referenceKey || initialTx?.referenceKey,
    items: items.length > 0 ? items : initialTx?.items,
    createdBy: initialTx?.createdBy || createdBy,
  });
}

/** Payload simpan cepat dari kartu review OCR: hasil OCR diutamakan atas isian form. */
export function buildQuickSavePayload(
  input: Omit<TransactionPayloadInput, 'items' | 'referenceKey'> & {
    ocr: Pick<OcrReceiptResult, 'referenceKey' | 'items'>;
    items: TransactionItem[];
    referenceKey: string | null | undefined;
  }
): PayloadResult {
  const { ocr, items, referenceKey, ...rest } = input;
  return buildTransactionPayload({
    ...rest,
    referenceKey: ocr.referenceKey || referenceKey,
    items: ocr.items || items,
  });
}

/** Payload simpan massal dari antrean review: hanya item yang tidak dikecualikan dan bernominal. */
export function buildBatchPayloads(
  queue: BatchReviewItem[],
  createdBy: Creator | undefined,
  now: number = Date.now()
): CreateTransactionInput[] {
  return queue
    .filter((item) => !item.isExcluded && item.nominal > 0)
    .map((item) => ({
      type: 'expense' as const,
      amount: item.nominal,
      accountId: item.accountId,
      categoryId: item.categoryId,
      date: new Date(item.date).getTime() || now,
      note: item.merchant.trim() || 'Struk Belanja',
      referenceKey: item.result.referenceKey,
      items: item.result.items,
      createdBy,
    }));
}
