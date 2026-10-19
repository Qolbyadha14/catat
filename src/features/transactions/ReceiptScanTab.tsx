import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { validateReceiptFile } from '../../lib/ocrService';
import { resizeImage } from '../../lib/ocr/imageProcessor';
import { scanReceiptWithGemini } from '../../lib/ocr/geminiService';
import {
  canScan,
  getRemainingScans,
  hasAcceptedDisclosure,
  acceptDisclosure,
} from '../../lib/ocr/rateLimiter';
import type { OcrReceiptResult } from '../../lib/ocr/schema';
import type { Category, Account } from '../../lib/schemas';

export const MAX_BATCH_FILES = 10;

export interface ReceiptScanTabProps {
  uid: string;
  categories?: Category[];
  accounts?: Account[];
  onScanSuccess: (result: OcrReceiptResult, previewUrl: string | null) => void;
  onBatchComplete?: (results: Array<{ result: OcrReceiptResult; previewUrl: string }>) => void;
  onCancelToManual: () => void;
}

export function validateBatchFiles(files: File[]): { valid: boolean; error?: string } {
  if (!files || files.length === 0) {
    return { valid: false, error: 'Pilih minimal 1 file gambar struk.' };
  }
  if (files.length > MAX_BATCH_FILES) {
    return {
      valid: false,
      error: `Maksimal ${MAX_BATCH_FILES} struk sekaligus per upload (Anda memilih ${files.length} file).`,
    };
  }
  for (const file of files) {
    const res = validateReceiptFile(file);
    if (!res.valid) {
      return {
        valid: false,
        error: `File "${file.name}": ${res.error ?? 'tidak valid.'}`,
      };
    }
  }
  return { valid: true };
}

export function checkBatchQuota(
  remaining: number,
  fileCount: number,
  mode: 'combine' | 'bulk'
): { allowed: boolean; error?: string } {
  const needed = mode === 'combine' ? 1 : fileCount;
  if (remaining < needed) {
    const error =
      mode === 'combine'
        ? 'Batas kuota harian tercapai. Silakan input transaksi manual.'
        : `Sisa kuota harian (${remaining}) tidak mencukupi untuk memindai ${fileCount} struk sekaligus.`;
    return { allowed: false, error };
  }
  return { allowed: true };
}

export function extractImageFileFromClipboard(clipboardData: DataTransfer | null): File | null {
  if (!clipboardData) return null;
  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  if (clipboardData.files) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (file && file.type.startsWith('image/')) {
        return file;
      }
    }
  }
  return null;
}

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Gagal membaca struk. Coba unggah ulang.';
  let clean = raw.replace(/^AI:\s*/i, '').replace(/\(AI\/[^)]+\)$/i, '').trim();
  if (clean.includes('timeout')) {
    clean = 'Waktu pemrosesan struk habis (timeout). Silakan coba lagi.';
  } else if (clean.includes('fetch-error') || clean.includes('Failed to fetch')) {
    clean = 'Gagal terhubung ke server OCR. Periksa koneksi internet Anda.';
  }
  return clean;
}

export function ReceiptScanTab({
  uid,
  categories,
  accounts,
  onScanSuccess,
  onBatchComplete,
  onCancelToManual,
}: ReceiptScanTabProps) {
  const [hasConsent, setHasConsent] = useState(() => hasAcceptedDisclosure(uid));
  const [remaining, setRemaining] = useState(() => getRemainingScans(uid));
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Staged files for 2+ multi-file selection
  const [stagedFiles, setStagedFiles] = useState<File[] | null>(null);
  const [stagedThumbnails, setStagedThumbnails] = useState<string[]>([]);
  const [scanMode, setScanMode] = useState<'combine' | 'bulk'>('combine');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort only when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Revoke object URL when previewUrl changes or unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Object URLs for staged thumbnails
  useEffect(() => {
    if (!stagedFiles || stagedFiles.length === 0) {
      setStagedThumbnails([]);
      return;
    }
    const urls = stagedFiles.map((f) => URL.createObjectURL(f));
    setStagedThumbnails(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [stagedFiles]);

  // Global paste handler for clipboard screenshot
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isProcessing) return;
      const file = extractImageFileFromClipboard(e.clipboardData);
      if (file) {
        e.preventDefault();
        handleFilesSelected([file]);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isProcessing, hasConsent, stagedFiles]);

  const handleConsent = () => {
    acceptDisclosure(uid);
    setHasConsent(true);
  };

  const handleFilesSelected = (incoming: File[]) => {
    setError(null);
    let targetFiles: File[];

    if (stagedFiles && stagedFiles.length > 0) {
      // Append to current staging
      targetFiles = [...stagedFiles, ...incoming];
    } else {
      targetFiles = incoming;
    }

    const validation = validateBatchFiles(targetFiles);
    if (!validation.valid) {
      setError(validation.error ?? 'File struk tidak valid.');
      return;
    }

    if (targetFiles.length === 1 && (!stagedFiles || stagedFiles.length === 0)) {
      // Direct single file scan
      const singleFile = targetFiles[0];
      if (singleFile) {
        handleProcessSingleFile(singleFile);
      }
    } else {
      // Multi-file staging
      setStagedFiles(targetFiles);
      setScanMode(targetFiles.length === 2 ? 'combine' : 'bulk');
    }
  };

  const handleProcessSingleFile = async (file: File) => {
    setError(null);

    if (!canScan(uid)) {
      setError('Batas kuota harian tercapai (maksimal 20 scan per hari). Silakan input transaksi manual.');
      return;
    }

    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      setError(validation.error ?? 'File struk tidak valid.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setIsProcessing(true);
    setStatusMessage('Mengoptimalkan ukuran gambar...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let msgTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      const resized = await resizeImage(file, 1200, 0.8);
      if (controller.signal.aborted) return;

      setStatusMessage('AI Gemini sedang membaca struk belanja...');
      msgTimer = setTimeout(() => {
        if (!controller.signal.aborted) {
          setStatusMessage('Menganalisis nominal total & merchant struk...');
        }
      }, 3000);

      const categoryContext = categories?.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));
      const accountContext = accounts?.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
      }));

      const result = await scanReceiptWithGemini(resized.blob, uid, {
        signal: controller.signal,
        timeoutMs: 60000,
        categories: categoryContext,
        accounts: accountContext,
      });

      setRemaining(getRemainingScans(uid));
      onScanSuccess(result, localUrl);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setError('Pemindaian struk dibatalkan.');
      } else {
        setError(cleanErrorMessage(err));
      }
    } finally {
      if (msgTimer) clearTimeout(msgTimer);
      setIsProcessing(false);
      setStatusMessage('');
      abortControllerRef.current = null;
    }
  };

  const handleProcessCombinedFiles = async (files: File[]) => {
    setError(null);
    if (!canScan(uid)) {
      setError('Batas kuota harian tercapai. Silakan input transaksi manual.');
      return;
    }

    const firstFile = files[0];
    const mainPreview = firstFile ? URL.createObjectURL(firstFile) : null;
    setPreviewUrl(mainPreview);
    setIsProcessing(true);
    setStatusMessage(`Mengoptimalkan ${files.length} gambar struk...`);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let msgTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      const resizedList = await Promise.all(
        files.map((f) => resizeImage(f, 1200, 0.8))
      );
      if (controller.signal.aborted) return;

      setStatusMessage(`AI Gemini menganalisis ${files.length} foto struk tergabung...`);
      msgTimer = setTimeout(() => {
        if (!controller.signal.aborted) {
          setStatusMessage('Menyatukan rincian struk & total akhir...');
        }
      }, 3000);

      const categoryContext = categories?.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));
      const accountContext = accounts?.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
      }));

      const result = await scanReceiptWithGemini(
        resizedList.map((r) => r.blob),
        uid,
        {
          signal: controller.signal,
          timeoutMs: 60000,
          categories: categoryContext,
          accounts: accountContext,
        }
      );

      setRemaining(getRemainingScans(uid));
      setStagedFiles(null);
      onScanSuccess(result, mainPreview);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setError('Pemindaian struk dibatalkan.');
      } else {
        setError(cleanErrorMessage(err));
      }
    } finally {
      if (msgTimer) clearTimeout(msgTimer);
      setIsProcessing(false);
      setStatusMessage('');
      abortControllerRef.current = null;
    }
  };

  const handleProcessBulkFiles = async (files: File[]) => {
    setError(null);
    const quota = checkBatchQuota(remaining, files.length, 'bulk');
    if (!quota.allowed) {
      setError(quota.error ?? 'Kuota tidak mencukupi.');
      return;
    }

    setIsProcessing(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const results: Array<{ result: OcrReceiptResult; previewUrl: string }> = [];
    const categoryContext = categories?.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));
    const accountContext = accounts?.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
    }));

    try {
      for (let i = 0; i < files.length; i++) {
        if (controller.signal.aborted) break;
        const file = files[i];
        if (!file) continue;

        const preview = URL.createObjectURL(file);
        setPreviewUrl(preview);
        setStatusMessage(`Mengekstrak struk ${i + 1} dari ${files.length}...`);

        try {
          const resized = await resizeImage(file, 1200, 0.8);
          if (controller.signal.aborted) break;

          const result = await scanReceiptWithGemini(
            resized.blob,
            uid,
            {
              signal: controller.signal,
              timeoutMs: 60000,
              categories: categoryContext,
              accounts: accountContext,
            }
          );
          results.push({ result, previewUrl: preview });
        } catch {
          const fallbackResult: OcrReceiptResult = {
            amount: 0,
            date: new Date().toISOString().slice(0, 10),
            merchant: null,
            confidence: 'low',
            categoryId: null,
            accountId: null,
            platform: 'other',
            paymentMethod: null,
            suggestedType: 'expense',
          };
          results.push({ result: fallbackResult, previewUrl: preview });
        }

        setRemaining(getRemainingScans(uid));
      }

      if (controller.signal.aborted) return;

      setStagedFiles(null);
      if (results.length > 0) {
        if (onBatchComplete) {
          onBatchComplete(results);
        } else {
          const first = results[0];
          if (first) {
            onScanSuccess(first.result, first.previewUrl);
          }
        }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setError('Pemindaian struk dibatalkan.');
      } else {
        setError(cleanErrorMessage(err));
      }
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      abortControllerRef.current = null;
    }
  };

  const handleStartScanStaged = async () => {
    if (!stagedFiles || stagedFiles.length === 0) return;

    const quota = checkBatchQuota(remaining, stagedFiles.length, scanMode);
    if (!quota.allowed) {
      setError(quota.error ?? 'Kuota tidak mencukupi.');
      return;
    }

    if (scanMode === 'combine') {
      await handleProcessCombinedFiles(stagedFiles);
    } else {
      await handleProcessBulkFiles(stagedFiles);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      handleFilesSelected(files);
    }
    e.target.value = '';
  };

  const handleCancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setStatusMessage('');
  };

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], 'clipboard.png', { type: imageType });
            handleFilesSelected([file]);
            return;
          }
        }
        setError('Tidak ada gambar di clipboard Anda. Silakan screenshot atau copy gambar struk terlebih dahulu.');
      } else {
        setError('Tekan tombol keyboard Cmd+V (Mac) atau Ctrl+V (Windows) untuk paste gambar.');
      }
    } catch {
      setError('Izin akses clipboard tidak aktif. Gunakan shortcut keyboard Cmd+V atau Ctrl+V.');
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  };

  if (!hasConsent) {
    return (
      <div className="ocr-disclosure-card">
        <div className="ocr-disclosure-icon">🤖</div>
        <h4 className="ocr-disclosure-title">Pindai Struk dengan AI</h4>
        <p className="ocr-disclosure-desc">
          Fitur ini menggunakan <strong>Google Gemini AI</strong> untuk membaca nominal, tanggal, dan nama toko
          secara otomatis dari foto struk belanja Anda.
        </p>
        <ul className="ocr-disclosure-points">
          <li>🔒 Foto diproses untuk ekstraksi data dan tidak disimpan permanen.</li>
          <li>⚡ Hasil scan hanya mengisi form draft — <strong>tidak langsung disimpan</strong> tanpa persetujuan Anda.</li>
          <li>📊 Kuota gratis 20 scan per hari (struk panjang 2 foto dihitung 1 kuota).</li>
        </ul>
        <button type="button" className="btn-hero" onClick={handleConsent}>
          Saya Mengerti & Lanjutkan
        </button>
      </div>
    );
  }

  return (
    <div className="ocr-tab-container">
      {/* Quota Header */}
      <div className="ocr-quota-header">
        <span className="ocr-quota-label">Kuota Harian OCR</span>
        <span className={`ocr-quota-pill ${remaining <= 3 ? 'low' : ''}`}>
          {remaining} / 20 sisa
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="form-error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="manage-toast-close"
            onClick={() => setError(null)}
            aria-label="Tutup pesan error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="ocr-hidden-input"
        onChange={handleFileChange}
        disabled={remaining <= 0}
        aria-label="Ambil foto struk dari kamera"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        multiple
        className="ocr-hidden-input"
        onChange={handleFileChange}
        disabled={remaining <= 0}
        aria-label="Pilih file gambar struk dari galeri"
      />

      {/* Processing State: Skeleton + Preview */}
      {isProcessing ? (
        <div className="ocr-processing-card">
          {previewUrl && (
            <div className="ocr-preview-wrap">
              <img src={previewUrl} alt="Preview struk yang sedang dipindai" className="ocr-preview-thumb" />
            </div>
          )}

          <div className="ocr-skeleton-wrap" aria-live="polite">
            <div className="ocr-skeleton-status">
              <div className="ocr-spinner" aria-hidden="true" />
              <span>{statusMessage || 'Sedang memproses struk...'}</span>
            </div>
            <div className="ocr-skeleton-line ocr-sk-amount" />
            <div className="ocr-skeleton-line ocr-sk-merchant" />
            <div className="ocr-skeleton-line ocr-sk-date" />
          </div>

          <button
            type="button"
            className="btn-outline"
            onClick={handleCancelScan}
            style={{ width: '100%', marginTop: 8 }}
          >
            Batal Scan
          </button>
        </div>
      ) : stagedFiles && stagedFiles.length > 1 ? (
        /* Staged Multi-File Selection & Mode Switcher */
        <div className="ocr-staged-card">
          <div className="ocr-staged-header">
            <h4>{stagedFiles.length} Foto Struk Terpilih</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              {stagedFiles.length < MAX_BATCH_FILES && (
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={() => fileInputRef.current?.click()}
                >
                  + Tambah Foto
                </button>
              )}
              <button
                type="button"
                className="btn-link-action"
                style={{ color: 'var(--muted-foreground)' }}
                onClick={() => setStagedFiles(null)}
              >
                Ganti
              </button>
            </div>
          </div>

          {/* Thumbnail preview row */}
          <div className="ocr-staged-thumbs">
            {stagedThumbnails.map((url, idx) => (
              <div key={idx} className="ocr-staged-thumb-item">
                <img src={url} alt={`Struk ${idx + 1}`} />
                <span className="ocr-staged-thumb-num">#{idx + 1}</span>
              </div>
            ))}
          </div>

          {/* Mode Switcher */}
          <div className="ocr-mode-selector">
            <button
              type="button"
              className={`ocr-mode-btn ${scanMode === 'combine' ? 'active' : ''}`}
              onClick={() => setScanMode('combine')}
            >
              <div className="ocr-mode-title">
                <span>🧩 Gabungkan jadi 1 Transaksi</span>
                <span className="ocr-mode-badge">1 Kuota</span>
              </div>
              <div className="ocr-mode-desc">
                Cocok untuk struk panjang TikTok Shop / Shopee yang terpotong 2 screenshot (atas & bawah).
              </div>
            </button>

            <button
              type="button"
              className={`ocr-mode-btn ${scanMode === 'bulk' ? 'active' : ''}`}
              onClick={() => setScanMode('bulk')}
            >
              <div className="ocr-mode-title">
                <span>📦 Pisahkan ({stagedFiles.length} Transaksi)</span>
                <span className="ocr-mode-badge">{stagedFiles.length} Kuota</span>
              </div>
              <div className="ocr-mode-desc">
                Cocok untuk banyak struk belanja berbeda yang ingin diinput sekaligus.
              </div>
            </button>
          </div>

          <div className="ocr-staged-actions">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setStagedFiles(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-hero"
              onClick={handleStartScanStaged}
              disabled={
                scanMode === 'combine'
                  ? remaining < 1
                  : remaining < stagedFiles.length
              }
            >
              Mulai Scan ({scanMode === 'combine' ? '1 Kuota' : `${stagedFiles.length} Kuota`})
            </button>
          </div>
        </div>
      ) : (
        /* Idle Upload Area */
        <div
          className={`ocr-dropzone ${isDragging ? 'dragging' : ''} ${remaining <= 0 ? 'disabled' : ''}`}
          onClick={(e) => {
            if (remaining > 0 && (e.target as HTMLElement).tagName !== 'BUTTON') {
              fileInputRef.current?.click();
            }
          }}
          onDragOver={remaining > 0 ? handleDragOver : undefined}
          onDragLeave={remaining > 0 ? handleDragLeave : undefined}
          onDrop={remaining > 0 ? handleDrop : undefined}
        >
          <div className="ocr-dropzone-icon">🧾</div>
          <h4 className="ocr-dropzone-title">Upload Foto Struk Belanja</h4>
          <p className="ocr-dropzone-subtitle">
            Foto bon kasir, struk belanja, atau tiket pembayaran Anda.
          </p>

          <div className="ocr-action-buttons">
            <button
              type="button"
              className="btn-solid ocr-btn-camera"
              onClick={() => cameraInputRef.current?.click()}
              disabled={remaining <= 0}
            >
              📷 Ambil Foto Kamera
            </button>
            <button
              type="button"
              className="btn-outline ocr-btn-gallery"
              onClick={() => fileInputRef.current?.click()}
              disabled={remaining <= 0}
            >
              🖼️ Pilih Galeri
            </button>
            <button
              type="button"
              className="btn-outline ocr-btn-paste"
              onClick={handlePasteClipboard}
              disabled={remaining <= 0}
              title="Paste screenshot dari clipboard"
            >
              📋 Paste
            </button>
          </div>

          <span className="ocr-dropzone-hint">
            JPG, PNG, atau WebP (maks. 20MB) • Bisa pilih hingga 10 struk atau gabung screenshot panjang
          </span>

          {remaining <= 0 && (
            <div className="ocr-limit-warning">
              ⚠️ Batas 20 scan harian telah tercapai. Kuota reset pukul 00:00 WIB.
              <button
                type="button"
                className="btn-link-action"
                style={{ display: 'block', margin: '4px auto 0' }}
                onClick={onCancelToManual}
              >
                Gunakan Input Manual
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
