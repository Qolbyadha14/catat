import { useState, useId, type FormEvent } from 'react';
import type { Account, Category, Transaction } from '../../lib/schemas';
import type { TransactionDraft } from './draft';
import { createTransaction, updateTransaction } from './transactionService';
import { TransactionTemplateBar } from './TransactionTemplateBar';
import { ReceiptScanTab } from './ReceiptScanTab';
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
    // Allow digits, operators (+, -, *, /), decimal dots, and whitespace
    const sanitized = val.replace(/,/g, '.').replace(/[^0-9+\-*/.\s]/g, '');
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
          <TransactionTemplateBar
            accounts={accounts}
            categories={categories}
            currentForm={{
              type,
              rawAmount,
              accountId: currentAccountId,
              toAccountId: currentToAccountId,
              categoryId: currentCategoryId,
              note,
            }}
            onApply={(resolved) => {
              setType(resolved.type);
              setRawAmount(String(resolved.amount));
              setAmountInput(new Intl.NumberFormat('id-ID').format(resolved.amount));
              setMathError(null);
              setAccountId(resolved.accountId);
              if (resolved.type === 'transfer') {
                setToAccountId(resolved.toAccountId);
              } else {
                setCategoryId(resolved.categoryId);
              }
              setNote(resolved.note);
            }}
            onError={setError}
          />

          {/* Tabs */}
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

          {activeTab === 'ocr' ? (
            <ReceiptScanTab
              uid={uid}
              onScanSuccess={(res) => {
                const rounded = Math.round(res.amount);
                setRawAmount(String(rounded));
                setAmountInput(new Intl.NumberFormat('id-ID').format(rounded));
                setMathError(null);
                if (res.date) {
                  setDateStr(res.date);
                }
                if (res.merchant) {
                  setNote(res.merchant);
                }
                setType('expense');
                setOcrFeedback({
                  confidence: res.confidence,
                  merchant: res.merchant,
                });
                setActiveTab('manual');
              }}
              onCancelToManual={() => setActiveTab('manual')}
            />
          ) : activeTab === 'text' ? (
            <div className="offline-banner" style={{ background: 'var(--surface)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>
              Mode asisten Ketik sedang disiapkan. Gunakan input manual atau scan struk.
            </div>
          ) : (
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
                    <select
                      className="form-select"
                      value={currentAccountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      {!currentAccountId && (
                        <option value="" disabled>
                          -- Pilih Akun Asal --
                        </option>
                      )}
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ke Akun Tujuan</label>
                    <select
                      className="form-select"
                      value={currentToAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                    >
                      {!currentToAccountId && (
                        <option value="" disabled>
                          -- Pilih Akun Tujuan --
                        </option>
                      )}
                      {toAccountOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Akun</label>
                    <select
                      className="form-select"
                      value={currentAccountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      {!currentAccountId && (
                        <option value="" disabled>
                          -- Pilih Akun --
                        </option>
                      )}
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <select
                      className="form-select"
                      value={currentCategoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      {!currentCategoryId && (
                        <option value="" disabled>
                          -- Pilih Kategori --
                        </option>
                      )}
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon ? `${c.icon} ` : ''}
                          {c.name}
                        </option>
                      ))}
                    </select>
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
          )}
        </form>
      </div>
    </div>
  );
}
