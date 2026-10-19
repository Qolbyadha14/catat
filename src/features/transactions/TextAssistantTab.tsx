import React, { useState, useEffect, useRef } from 'react';
import type { Category, Account } from '../../lib/schemas';
import {
  parseTransactionText,
  type ParsedTransactionResult,
  type TextCategoryContext,
  type TextAccountContext,
} from '../../lib/nlp/textAssistantService';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
  type SpeechRecognizerController,
} from '../../lib/speech/speechRecognition';

interface TextAssistantTabProps {
  categories: Category[];
  accounts: Account[];
  onParsed: (result: ParsedTransactionResult) => void;
  onCancelToManual: () => void;
}

const SUGGESTIONS = [
  '🍜 Makan siang padang 35rb pake Gopay',
  '⛽ Beli bensin 50k Cash',
  '☕ Kopi susu 25k SPayLater',
  '💸 Transfer 200rb dari BCA ke Jago',
  '💰 Gaji bulanan masuk 8.5jt ke BCA',
];

export const TextAssistantTab: React.FC<TextAssistantTabProps> = ({
  categories,
  accounts,
  onParsed,
  onCancelToManual,
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognizerRef = useRef<SpeechRecognizerController | null>(null);

  const categoryContexts: TextCategoryContext[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  const accountContexts: TextAccountContext[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
  }));

  const handleProcess = async (textToProcess?: string) => {
    const text = (textToProcess ?? inputText).trim();
    if (!text) {
      setErrorMessage('Ketik kalimat transaksi terlebih dahulu (contoh: Makan siang 35rb pake gopay).');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const result = await parseTransactionText(text, {
        categories: categoryContexts,
        accounts: accountContexts,
      });

      if (!result.amount || result.amount <= 0) {
        setErrorMessage(
          'Nominal transaksi belum terdeteksi. Coba sertakan nominal seperti "35rb", "50k", atau "100.000".'
        );
        setIsProcessing(false);
        return;
      }

      onParsed(result);
    } catch (err) {
      console.error('Failed to parse text transaction:', err);
      setErrorMessage('Terjadi kendala saat memproses teks. Silakan coba lagi atau isi manual.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const supported = isSpeechRecognitionSupported();
    setSpeechSupported(supported);
    if (!supported) return;

    const controller = createSpeechRecognizer({
      lang: 'id-ID',
      onStart: () => {
        setIsRecording(true);
        setErrorMessage(null);
      },
      onResult: (text, isFinal) => {
        setInputText(text);
        if (isFinal) {
          setIsRecording(false);
          void handleProcess(text);
        }
      },
      onError: (err) => {
        setIsRecording(false);
        if (err === 'not-allowed') {
          setErrorMessage('Izin mikrofon tidak diberikan. Silakan izinkan akses mikrofon di browser.');
        } else if (err === 'no-speech') {
          setErrorMessage('Suara tidak terdeteksi. Silakan coba bicara kembali.');
        } else {
          setErrorMessage(`Kendala pengenalan suara (${err}). Silakan ketik manual.`);
        }
      },
      onEnd: () => {
        setIsRecording(false);
      },
    });

    recognizerRef.current = controller;

    return () => {
      controller?.abort();
    };
  }, []);

  const toggleRecording = () => {
    if (!recognizerRef.current) return;
    if (isRecording) {
      recognizerRef.current.stop();
    } else {
      recognizerRef.current.start();
    }
  };

  const handleChipClick = (suggestion: string) => {
    // Strip leading emoji
    const cleaned = suggestion.replace(/^[^\w\s]+\s*/, '');
    setInputText(cleaned);
    void handleProcess(cleaned);
  };

  return (
    <div className="text-assistant-container" role="region" aria-label="Mode Asisten Ketik">
      <div className="text-assistant-header">
        <div className="text-assistant-badge">
          <span className="sparkle-icon">✨</span>
          <span>Asisten AI Natural Language</span>
        </div>
        <p className="text-assistant-subtitle">
          Ketik transaksi dalam bahasa santai sehari-hari atau tekan tombol mikrofon untuk bicara. AI & parser otomatis mendeteksi nominal, kategori, dan akun Anda.
        </p>
      </div>

      <div className="text-assistant-card">
        <textarea
          className="text-assistant-textarea"
          placeholder="Contoh: Makan siang 35rb pake Gopay, Beli bensin 50k cash kemarin..."
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleProcess();
            }
          }}
          disabled={isProcessing}
          rows={3}
          autoFocus
        />

        <div className="text-assistant-actions">
          {speechSupported && (
            <button
              type="button"
              className={`text-assistant-mic-btn ${isRecording ? 'is-recording' : ''}`}
              onClick={toggleRecording}
              disabled={isProcessing}
              title={isRecording ? 'Klik untuk berhenti merekam' : 'Catat pakai suara'}
              aria-label={isRecording ? 'Berhenti merekam suara' : 'Catat transaksi pakai suara'}
            >
              {isRecording ? (
                <>
                  <span className="mic-pulse-dot" aria-hidden="true" />
                  <span>Mendengarkan...</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">🎙️</span>
                  <span>Bicara</span>
                </>
              )}
            </button>
          )}

          {inputText && (
            <button
              type="button"
              className="text-assistant-clear-btn"
              onClick={() => {
                setInputText('');
                setErrorMessage(null);
              }}
              disabled={isProcessing}
            >
              Hapus
            </button>
          )}

          <button
            type="button"
            className="text-assistant-submit-btn"
            onClick={() => void handleProcess()}
            disabled={isProcessing || !inputText.trim()}
          >
            {isProcessing ? (
              <>
                <span className="spinner-sm" aria-hidden="true" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>✨ Proses Teks</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="text-assistant-error" role="alert">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      <div className="text-assistant-suggestions">
        <span className="text-assistant-suggestions-label">Contoh Cepat:</span>
        <div className="text-assistant-chips-grid">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className="text-assistant-chip"
              onClick={() => handleChipClick(s)}
              disabled={isProcessing}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="text-assistant-footer">
        <button
          type="button"
          className="text-assistant-cancel-btn"
          onClick={onCancelToManual}
          disabled={isProcessing}
        >
          ← Kembali ke Input Manual
        </button>
      </div>
    </div>
  );
};
