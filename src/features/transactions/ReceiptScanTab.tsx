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

interface ReceiptScanTabProps {
  uid: string;
  onScanSuccess: (result: OcrReceiptResult) => void;
  onCancelToManual: () => void;
}

export function ReceiptScanTab({ uid, onScanSuccess, onCancelToManual }: ReceiptScanTabProps) {
  const [hasConsent, setHasConsent] = useState(() => hasAcceptedDisclosure(uid));
  const [remaining, setRemaining] = useState(() => getRemainingScans(uid));
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleConsent = () => {
    acceptDisclosure(uid);
    setHasConsent(true);
  };

  const handleProcessFile = async (file: File) => {
    setError(null);

    // 1. Quota check
    if (!canScan(uid)) {
      setError('Batas kuota harian tercapai (maksimal 20 scan per hari). Silakan input transaksi manual.');
      return;
    }

    // 2. Client File Validation
    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      setError(validation.error ?? 'File struk tidak valid.');
      return;
    }

    // 3. Preview URL
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setIsProcessing(true);
    setStatusMessage('Mengoptimalkan ukuran gambar...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let msgTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      // 4. Client resize: 1200px and 0.8 quality for fast mobile uploads and instant AI tokenization
      const resized = await resizeImage(file, 1200, 0.8);

      if (controller.signal.aborted) return;

      setStatusMessage('AI Gemini sedang membaca struk belanja...');
      msgTimer = setTimeout(() => {
        if (!controller.signal.aborted) {
          setStatusMessage('Menganalisis nominal total & merchant struk...');
        }
      }, 3000);

      // 5. Invoke AI
      const result = await scanReceiptWithGemini(resized.blob, uid, {
        signal: controller.signal,
        timeoutMs: 60000,
      });

      // Update remaining quota state
      setRemaining(getRemainingScans(uid));

      // 6. Zero auto-save: handoff to parent form
      onScanSuccess(result);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setError('Pemindaian struk dibatalkan.');
      } else {
        const raw = err instanceof Error ? err.message : 'Gagal membaca struk. Coba unggah ulang.';
        // Strip technical prefixes if any
        let clean = raw.replace(/^AI:\s*/i, '').replace(/\(AI\/[^)]+\)$/i, '').trim();
        if (clean.includes('timeout')) {
          clean = 'Waktu pemrosesan struk habis (timeout). Silakan coba lagi.';
        } else if (clean.includes('fetch-error') || clean.includes('Failed to fetch')) {
          clean = 'Gagal terhubung ke server OCR. Periksa koneksi internet Anda.';
        }
        setError(clean);
      }
    } finally {
      if (msgTimer) clearTimeout(msgTimer);
      setIsProcessing(false);
      setStatusMessage('');
      abortControllerRef.current = null;
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
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
          <li>📊 Kuota gratis 20 scan per hari.</li>
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
            className="ocr-hidden-input"
            onChange={handleFileChange}
            disabled={remaining <= 0}
            aria-label="Pilih file gambar struk dari galeri"
          />

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
              🖼️ Pilih dari Galeri
            </button>
          </div>

          <span className="ocr-dropzone-hint">
            Format JPG, PNG, atau WebP (maks. 20MB)
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
