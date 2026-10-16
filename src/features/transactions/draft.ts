export type DraftField = 'amount' | 'type' | 'accountId' | 'toAccountId' | 'categoryId' | 'date' | 'note';

export type DraftSource = 'manual' | 'text' | 'ocr';

export interface TransactionDraft {
  source: DraftSource;
  values: Partial<Record<DraftField, unknown>>;
  lowConfidence: ReadonlySet<DraftField>;
}
