import { useState, useId, type FormEvent } from 'react';
import type { Account, Category, Transaction } from '../../lib/schemas';
import type { TransactionDraft } from './draft';
import { createTransaction, updateTransaction } from './transactionService';
import { ReceiptScanTab } from './ReceiptScanTab';
import { CategoryChipGrid } from './CategoryChipGrid';
import { AccountPillSelector } from './AccountPillSelector';
import { OcrReviewCard, formatReviewNote } from './OcrReviewCard';
import type { OcrReceiptResult } from '../../lib/ocr/schema';
import type { DuplicateFormValues } from '../../lib/transactionDuplicate';
import { evaluateMathExpression } from '../../lib/mathEvaluator';

interface TransactionFormSheetProps {
  uid: string;
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  initialTx?: Transaction | null;
  duplicateData?: DuplicateFormValues | null;
  initialDraft?: TransactionDraft;
  onSuccess?: () => void;
}

export function TransactionFormSheet({
  uid,
  isOpen,
  onClose,
  accounts,
  categories,
  initialTx,
  duplicateData,
  initialDraft,
  onSuccess,
}: TransactionFormSheetProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'text' | 'ocr'>('manual');
  const [ocrReview, setOcrReview] = useState<{
    result: OcrReceiptResult;
    previewUrl: string | null;
  } | null>(null);
  const [recommendedCategoryId, setRecommendedCategoryId] = useState<string | null>(null);
  const [ocrFeedback, setOcrFeedback] = useState<{
    confidence: 'high' | 'low';
    merchant: string | null;
  } | null>(() => {
    if (initialDraft?.source === 'ocr') {
      return {
        confidence: initialDraft.lowConfidence.size > 0 ? 'low' : 'high',
        merchant: typeof initialDraft.values.note === 'string' ? initialDraft.values.note : null,
      };
    }
    return null;
  });
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    initialTx?.type ?? duplicateData?.type ?? (initialDraft?.values.type as 'expense' | 'income' | 'transfer') ?? 'expense'
  );
  const [rawAmount, setRawAmount] = useState<string>(() => {
    if (initialTx) return String(initialTx.amount);
    if (duplicateData) return String(duplicateData.amount);
    if (initialDraft?.values.amount) return String(initialDraft.values.amount);
    return '';
  });
  const [amountInput, setAmountInput] = useState<string>(() => {
    if (initialTx) return new Intl.NumberFormat('id-ID').format(initialTx.amount);
    if (duplicateData) return new Intl.NumberFormat('id-ID').format(duplicateData.amount);
    if (initialDraft?.values.amount) {
      const num = Number(initialDraft.values.amount);
      return Number.isNaN(num) ? '' : new Intl.NumberFormat('id-ID').format(num);
    }
    return '';
  });
  const [mathError, setMathError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>(() => {
    if (initialTx) {
      return initialTx.type === 'transfer'
        ? initialTx.fromAccountId
        : initialTx.accountId;
    }
    if (duplicateData) {
      return duplicateData.accountId;
    }
    if (initialDraft?.values.accountId && typeof initialDraft.values.accountId === 'string') {
      return initialDraft.values.accountId;
    }
    return accounts[0]?.id ?? '';
  });
  const [toAccountId, setToAccountId] = useState<string>(() => {
    if (initialTx && initialTx.type === 'transfer') {
      return initialTx.toAccountId;
    }
    if (duplicateData && duplicateData.type === 'transfer') {
      return duplicateData.toAccountId;
    }
    if (initialDraft?.values.toAccountId && typeof initialDraft.values.toAccountId === 'string') {
      return initialDraft.values.toAccountId;
    }
    return accounts[1]?.id ?? '';
  });
  const [categoryId, setCategoryId] = useState<string>(() => {
    if (initialTx && initialTx.type !== 'transfer') {
      return initialTx.categoryId;
    }
    if (duplicateData && duplicateData.type !== 'transfer') {
      return duplicateData.categoryId;
    }
    if (initialDraft?.values.categoryId && typeof initialDraft.values.categoryId === 'string') {
      return initialDraft.values.categoryId;
    }
    return '';
  });
  const [dateStr, setDateStr] = useState<string>(() => {
    if (initialTx) {
      return new Date(initialTx.date).toISOString().slice(0, 10);
    }
    if (duplicateData) {
      return duplicateData.date.toISOString().slice(0, 10);
    }
    if (initialDraft?.values.date && typeof initialDraft.values.date === 'string') {
      return initialDraft.values.date;
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [note, setNote] = useState<string>(
    initialTx?.note ?? duplicateData?.note ?? (typeof initialDraft?.values.note === 'string' ? initialDraft.values.note : '')
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountInputId = useId();

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === type);
  const isCategoryValid = filteredCategories.some((c) => c.id === categoryId);
  const currentCategoryId = isCategoryValid
    ? categoryId
    : (duplicateData ? '' : filteredCategories[0]?.id || '');

  const isAccountValid = accounts.some((a) => a.id === accountId);
  const currentAccountId = isAccountValid
    ? accountId
    : (duplicateData ? '' : accounts[0]?.id || '');

  // Transfer: exclude fromAccountId from toAccountId choices
  const toAccountOptions = accounts.filter((a) => a.id !== currentAccountId);
  const isToAccountValid = toAccountOptions.some((a) => a.id === toAccountId);
  const currentToAccountId = isToAccountValid
    ? toAccountId
    : (duplicateData ? '' : toAccountOptions[0]?.id || '');

  const handleAmountChange = (val: string) => {
    // Allow digits, operators (+, -, *, /), dots, commas, k/rb suffixes, and whitespace
    const sanitized = val.replace(/[^0-9+\-*/.,kKrRbB\s]/g, '');
    setAmountInput(sanitized);
    if (mathError) setMathError(null);
  };

  const evaluateInput = (text: string) => {
    if (!text.trim()) {
      setRawAmount('');
      setAmountInput('');
      setMathError(null);
      return;
    }

    const res = evaluateMathExpression(text);
    if (res.success) {
      const rounded = Math.round(res.value);
      setRawAmount(String(rounded));
      setAmountInput(new Intl.NumberFormat('id-ID').format(rounded));
      setMathError(null);
    } else {
      // Keep last valid rawAmount, show red helper without blocking
      setMathError(res.error);
    }
  };

  const handleAmountFocus = () => {
    if (!mathError && rawAmount) {
      setAmountInput(rawAmount);
    }
  };

  const handleAmountBlur = () => {
    evaluateInput(amountInput);
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      evaluateInput(amountInput);
    }
  };

  const handleAddAmount = (delta: number) => {
    let current = parseInt(rawAmount, 10);
    if (Number.isNaN(current) || current < 0) current = 0;
    const next = current + delta;
    setRawAmount(String(next));
    setAmountInput(new Intl.NumberFormat('id-ID').format(next));
    if (mathError) setMathError(null);
  };

  const handleOcrSuccess = (res: OcrReceiptResult, previewUrl: string | null) => {
    // 1. Resolve category
    let matchedCatId = res.categoryId;
    if (matchedCatId && !categories.some((c) => c.id === matchedCatId)) {
      matchedCatId = null;
    }
    if (!matchedCatId) {
      if (res.platform === 'shopeefood' || res.platform === 'gofood') {
        const foodCat = categories.find(
          (c) => !c.isArchived && c.type === 'expense' && /makan|minum|food|kuliner/i.test(c.name)
        );
        if (foodCat) matchedCatId = foodCat.id;
      }
    }

    // 2. Resolve account
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

    // 3. Format note with platform and paymentMethod
    const formattedNote = formatReviewNote(res.merchant, res.paymentMethod, res.platform);

    const rounded = Math.round(res.amount);
    setRawAmount(String(rounded));
    setAmountInput(new Intl.NumberFormat('id-ID').format(rounded));
    setMathError(null);
    if (res.date) setDateStr(res.date);
    setNote(formattedNote);
    setType(res.suggestedType || 'expense');
    if (matchedCatId) {
      setCategoryId(matchedCatId);
      setRecommendedCategoryId(matchedCatId);
    }
    if (matchedAccId) {
      setAccountId(matchedAccId);
    }

    setOcrFeedback({
      confidence: res.confidence,
      merchant: res.merchant,
    });

    setOcrReview({
      result: {
        ...res,
        categoryId: matchedCatId,
        accountId: matchedAccId,
      },
      previewUrl,
    });
  };

  const handleQuickSave = async () => {
    if (!ocrReview) return;
    setError(null);
    const finalAmount = parseInt(rawAmount, 10);
    if (!finalAmount || finalAmount <= 0) {
      setError('Masukkan nominal yang valid');
      return;
    }
    if (!currentAccountId) {
      setError('Pilih akun transaksi');
      return;
    }
    if (type !== 'transfer' && !currentCategoryId) {
      setError('Pilih kategori transaksi');
      return;
    }

    const epochDate = new Date(dateStr).getTime() || Date.now();
    try {
      setSaving(true);
      if (type === 'transfer') {
        await createTransaction(uid, {
          type: 'transfer',
          amount: finalAmount,
          fromAccountId: currentAccountId,
          toAccountId: currentToAccountId,
          date: epochDate,
          note,
        });
      } else {
        await createTransaction(uid, {
          type,
          amount: finalAmount,
          accountId: currentAccountId,
          categoryId: currentCategoryId,
          date: epochDate,
          note,
        });
      }
      setOcrReview(null);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    let finalAmount = parseInt(rawAmount, 10);
    if (amountInput.trim()) {
      const res = evaluateMathExpression(amountInput);
      if (res.success) {
        finalAmount = Math.round(res.value);
        setRawAmount(String(finalAmount));
        setAmountInput(new Intl.NumberFormat('id-ID').format(finalAmount));
        setMathError(null);
      } else if (!finalAmount) {
        setMathError(res.error);
        setError('Masukkan nominal yang valid');
        return;
      }
    }

    if (!finalAmount || finalAmount <= 0) {
      setError('Masukkan nominal yang valid');
      return;
    }

    if (!currentAccountId) {
      setError('Pilih akun transaksi');
      return;
    }

    const epochDate = new Date(dateStr).getTime() || Date.now();

    try {
      setSaving(true);
      if (type === 'transfer') {
        if (!currentToAccountId || currentToAccountId === currentAccountId) {
          setError('Pilih akun tujuan transfer yang berbeda');
          return;
        }
        const payload = {
          type: 'transfer' as const,
          amount: finalAmount,
          fromAccountId: currentAccountId,
          toAccountId: currentToAccountId,
          date: epochDate,
          note: note.trim(),
        };
        if (initialTx) {
          await updateTransaction(uid, initialTx.id, payload);
        } else {
          await createTransaction(uid, payload);
        }
      } else {
        if (!currentCategoryId) {
          setError('Pilih kategori transaksi');
          return;
        }
        const payload = {
          type,
          amount: finalAmount,
          accountId: currentAccountId,
          categoryId: currentCategoryId,
          date: epochDate,
          note: note.trim(),
        };
        if (initialTx) {
          await updateTransaction(uid, initialTx.id, payload);
        } else {
          await createTransaction(uid, payload);
        }
      }

      // Reset
      setRawAmount('');
      setAmountInput('');
      setMathError(null);
      setNote('');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan transaksi';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle-bar">
          <div className="sheet-handle" />
        </div>

        <div className="sheet-header">
          <h3>{initialTx ? 'Ubah Transaksi' : duplicateData ? 'Duplikat Transaksi' : 'Catat Transaksi'}</h3>
          <button type="button" className="btn-close-sheet" onClick={onClose} aria-label="Tutup" title="Tutup modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-scroll-body">
          {/* Ocr Review Card if present */}
          {ocrReview && (
            <OcrReviewCard
              result={ocrReview.result}
              previewUrl={ocrReview.previewUrl}
              categoryName={categories.find((c) => c.id === currentCategoryId)?.name}
              categoryIcon={categories.find((c) => c.id === currentCategoryId)?.icon}
              accountName={accounts.find((a) => a.id === currentAccountId)?.name}
              onQuickSave={handleQuickSave}
              onEditDetails={() => {
                setOcrReview(null);
                setActiveTab('manual');
              }}
              onDiscard={() => setOcrReview(null)}
              isSaving={saving}
            />
          )}

          {/* Tabs */}
          {!ocrReview && (
            <div className="tabs-segmented">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                onClick={() => setActiveTab('manual')}
              >
                Manual
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
                title="Input Asisten Teks"
              >
                Ketik
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'ocr' ? 'active' : ''}`}
                onClick={() => setActiveTab('ocr')}
                title="Scan Struk OCR"
              >
                Scan
              </button>
            </div>
          )}

          {!ocrReview && activeTab === 'ocr' ? (
            <ReceiptScanTab
              uid={uid}
              categories={categories}
              accounts={accounts}
              onScanSuccess={handleOcrSuccess}
              onCancelToManual={() => setActiveTab('manual')}
            />
          ) : !ocrReview && activeTab === 'text' ? (
            <div className="offline-banner" style={{ background: 'var(--surface)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>
              Mode asisten Ketik sedang disiapkan. Gunakan input manual atau scan struk.
            </div>
          ) : !ocrReview ? (
            <>
              {ocrFeedback && (
                <div
                  className={`ocr-review-badge ${ocrFeedback.confidence === 'high' ? 'high' : 'low'}`}
                  role="status"
                >
                  <div className="ocr-review-text">
                    <strong>
                      {ocrFeedback.confidence === 'high' ? '✓ Struk Berhasil Dibaca' : '⚠️ Akurasi Rendah (Periksa Manual)'}
                    </strong>
                    <span>
                      {ocrFeedback.merchant ? `${ocrFeedback.merchant} • ` : ''}Data struk terisi otomatis. Periksa akun & kategori sebelum menyimpan.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-close-ocr-banner"
                    onClick={() => setOcrFeedback(null)}
                    aria-label="Tutup notifikasi scan"
                  >
                    ✕
                  </button>
                </div>
              )}

              {error && (
                <div className="form-error-banner">
                  <span>{error}</span>
                  <button type="submit" className="btn-retry" disabled={saving}>
                    Coba Lagi
                  </button>
                </div>
              )}

              {/* Type Selector */}
              <div className="form-group">
                <label className="form-label">Jenis</label>
                <div className="pills-type-selector">
                  <button
                    type="button"
                    className={`pill-type-btn ${type === 'expense' ? 'active' : ''}`}
                    onClick={() => setType('expense')}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    className={`pill-type-btn ${type === 'income' ? 'active' : ''}`}
                    onClick={() => setType('income')}
                  >
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    className={`pill-type-btn ${type === 'transfer' ? 'active' : ''}`}
                    onClick={() => setType('transfer')}
                  >
                    Transfer
                  </button>
                </div>
              </div>

              {/* Amount Hero */}
              <div className="form-group">
                <label htmlFor={amountInputId} className="form-label">
                  Nominal (IDR)
                </label>
                <div className="amount-input-wrap">
                  <span>Rp</span>
                  <input
                    id={amountInputId}
                    type="text"
                    className="input-hero-amount"
                    placeholder="0"
                    value={amountInput}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onFocus={handleAmountFocus}
                    onBlur={handleAmountBlur}
                    onKeyDown={handleAmountKeyDown}
                    autoFocus
                    required
                  />
                </div>
                <div className="quick-amount-chips">
                  <button
                    type="button"
                    className="quick-amount-chip"
                    onClick={() => handleAddAmount(10000)}
                  >
                    +10rb
                  </button>
                  <button
                    type="button"
                    className="quick-amount-chip"
                    onClick={() => handleAddAmount(50000)}
                  >
                    +50rb
                  </button>
                  <button
                    type="button"
                    className="quick-amount-chip"
                    onClick={() => handleAddAmount(100000)}
                  >
                    +100rb
                  </button>
                </div>
                {mathError && (
                  <div className="input-helper-error" role="alert">
                    {mathError}
                  </div>
                )}
              </div>

              {/* Account Pickers */}
              {type === 'transfer' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Dari Akun</label>
                    <AccountPillSelector
                      accounts={accounts}
                      selectedId={currentAccountId}
                      onSelect={setAccountId}
                      label="Dari Akun"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ke Akun Tujuan</label>
                    <AccountPillSelector
                      accounts={accounts}
                      selectedId={currentToAccountId}
                      onSelect={setToAccountId}
                      label="Ke Akun Tujuan"
                      excludeId={currentAccountId}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Akun</label>
                    <AccountPillSelector
                      accounts={accounts}
                      selectedId={currentAccountId}
                      onSelect={setAccountId}
                      label="Pilih Akun"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <CategoryChipGrid
                      categories={categories}
                      type={type}
                      selectedId={currentCategoryId}
                      onSelect={setCategoryId}
                      recommendedId={recommendedCategoryId}
                    />
                  </div>
                </>
              )}

              {/* Date & Note */}
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Catatan (Opsional)</label>
                <input
                  type="text"
                  maxLength={140}
                  className="form-input"
                  placeholder="Misal: Makan siang kantor"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="btn-hero"
                style={{ marginTop: 12, marginBottom: 8 }}
                disabled={saving}
              >
                {saving ? 'Menyimpan...' : initialTx ? 'Simpan Perubahan' : 'Simpan Transaksi'}
              </button>
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}
