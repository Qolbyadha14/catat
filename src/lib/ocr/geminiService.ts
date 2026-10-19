import { getAI, getGenerativeModel, GoogleAIBackend, SchemaType } from 'firebase/ai';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { app, db } from '../firebase';
import { parseOcrReceipt, type OcrReceiptResult } from './schema';
import { recordScan } from './rateLimiter';

export interface ScanOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  modelName?: string;
}

export const OCR_DAILY_LIMIT = 20;
export const DEFAULT_OCR_MODEL = 'gemini-3.8-flash';

export async function blobToGenerativePart(
  blob: Blob
): Promise<{ type: 'inlineData'; inlineData: { data: string; mimeType: string } }> {
  const mimeType = blob.type || 'image/jpeg';

  if (typeof FileReader !== 'undefined') {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string) || '';
        const base64Data = result.split(',')[1] || '';
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return {
      type: 'inlineData',
      inlineData: {
        data: base64,
        mimeType,
      },
    };
  }

  const buffer = await blob.arrayBuffer();
  let base64 = '';
  const maybeBuffer = (globalThis as unknown as { Buffer?: { from: (b: ArrayBuffer) => { toString: (enc: string) => string } } }).Buffer;
  if (typeof maybeBuffer !== 'undefined') {
    base64 = maybeBuffer.from(buffer).toString('base64');
  } else {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    base64 = btoa(binary);
  }

  return {
    type: 'inlineData',
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}

export function formatOcrDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function checkScanQuota(uid: string, today: Date = new Date()): Promise<number> {
  const dateKey = formatOcrDateKey(today);
  const usageId = `${uid}_${dateKey}`;
  const usageRef = doc(db, 'scanUsage', usageId);
  const snap = await getDoc(usageRef);
  const current = snap.exists() ? (snap.data().count ?? 0) : 0;
  if (current >= OCR_DAILY_LIMIT) {
    throw new Error('Batas kuota harian tercapai (maksimal 20 scan per hari).');
  }
  return current;
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

export function getGeminiModel(modelName: string = DEFAULT_OCR_MODEL) {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: modelName,
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
  const { timeoutMs = 45000, signal, modelName = DEFAULT_OCR_MODEL } = options;

  // 1. Pre-check quota BEFORE invoking AI (do not increment yet)
  await checkScanQuota(uid);

  // 2. Prepare part & model
  const imagePart = await blobToGenerativePart(blob);
  const model = getGeminiModel(modelName);

  // 3. Request with 45s timeout
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Waktu pemrosesan struk habis (timeout 45 detik). Silakan coba lagi.'));
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
    const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const rawJson = JSON.parse(cleaned);

    if (!rawJson.amount || typeof rawJson.amount !== 'number' || rawJson.amount <= 0) {
      throw new Error('Nominal total struk tidak terdeteksi jelas. Pastikan foto struk terang dan angka total terlihat.');
    }

    return parseOcrReceipt(rawJson);
  })();

  let result: OcrReceiptResult;
  try {
    result = await Promise.race([generatePromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  // 4. Only commit quota increment on successful AI extraction
  await incrementScanUsage(uid);

  return result;
}
