import { getAI, getGenerativeModel, GoogleAIBackend, SchemaType } from 'firebase/ai';
import { doc, runTransaction } from 'firebase/firestore';
import { app, db } from '../firebase';
import { parseOcrReceipt, type OcrReceiptResult } from './schema';
import { recordScan } from './rateLimiter';

export interface ScanOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const OCR_DAILY_LIMIT = 20;

export async function blobToGenerativePart(
  blob: Blob
): Promise<{ type: 'inlineData'; inlineData: { data: string; mimeType: string } }> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binary);
  return {
    type: 'inlineData',
    inlineData: {
      data: base64,
      mimeType: blob.type || 'image/jpeg',
    },
  };
}

export function formatOcrDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function incrementScanUsage(uid: string, today: Date = new Date()): Promise<number> {
  const dateKey = formatOcrDateKey(today);
  const usageId = `${uid}_${dateKey}`;
  const usageRef = doc(db, 'scanUsage', usageId);

  const nextCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(usageRef);
    const current = snap.exists() ? (snap.data().count ?? 0) : 0;
    if (current >= OCR_DAILY_LIMIT) {
      throw new Error('Batas kuota harian tercapai (maksimal 20 scan per hari).');
    }
    const updated = current + 1;
    tx.set(
      usageRef,
      {
        uid,
        date: dateKey,
        count: updated,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return updated;
  });

  recordScan(uid, dateKey);
  return nextCount;
}

export function getGeminiModel() {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: 'gemini-3.8-flash',
    systemInstruction:
      'Kamu adalah sistem OCR struk belanja Indonesia. Ekstrak total belanja (nominal rupiah integer positif, abaikan subtotal atau diskon), tanggal transaksi format YYYY-MM-DD, dan nama merchant/toko. Jika tidak ada informasi tanggal atau merchant, set null. Confidence bernilai "high" jika total terlihat jelas, atau "low" jika struk pudar, miring parah, atau angka diragukan.',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          amount: {
            type: SchemaType.INTEGER,
            description: 'Nominal total belanja rupiah integer positif',
          },
          date: {
            type: SchemaType.STRING,
            description: 'Tanggal transaksi YYYY-MM-DD',
            nullable: true,
          },
          merchant: {
            type: SchemaType.STRING,
            description: 'Nama toko atau merchant',
            nullable: true,
          },
          confidence: {
            type: SchemaType.STRING,
            enum: ['high', 'low'],
            description: 'Tingkat kepastian pembacaan',
          },
        },
        required: ['amount', 'confidence'],
      },
    },
  });
}

export async function scanReceiptWithGemini(
  blob: Blob,
  uid: string,
  options: ScanOptions = {}
): Promise<OcrReceiptResult> {
  const { timeoutMs = 15000, signal } = options;

  // 1. Atomic Firestore transaction counter check
  await incrementScanUsage(uid);

  // 2. Prepare part & model
  const imagePart = await blobToGenerativePart(blob);
  const model = getGeminiModel();

  // 3. Request with 15s timeout
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Waktu pemrosesan struk habis (timeout 15 detik). Silakan coba lagi.'));
    }, timeoutMs);

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          if (timer) clearTimeout(timer);
          reject(signal.reason || new Error('Scan dibatalkan.'));
        },
        { once: true }
      );
    }
  });

  const generatePromise = (async () => {
    const res = await model.generateContent([
      imagePart,
      'Ekstrak informasi struk transaksi ini sesuai JSON schema.',
    ]);
    const text = res.response.text();
    const rawJson = JSON.parse(text);
    return parseOcrReceipt(rawJson);
  })();

  try {
    const result = await Promise.race([generatePromise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
