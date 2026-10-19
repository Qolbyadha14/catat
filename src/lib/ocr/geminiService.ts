import { getAI, getGenerativeModel, GoogleAIBackend, SchemaType } from 'firebase/ai';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { app, db } from '../firebase';
import { parseOcrReceipt, type OcrReceiptResult } from './schema';
import { recordScan } from './rateLimiter';

export interface OcrCategoryContext {
  id: string;
  name: string;
  type: 'expense' | 'income';
}

export interface OcrAccountContext {
  id: string;
  name: string;
  kind: 'asset' | 'liability';
}

export interface ScanOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  modelName?: string;
  categories?: OcrCategoryContext[];
  accounts?: OcrAccountContext[];
}

export const OCR_DAILY_LIMIT = 20;
export const DEFAULT_OCR_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_OCR_MODEL = 'gemini-3.5-flash';

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

export function buildOcrSystemInstruction(
  categories?: OcrCategoryContext[],
  accounts?: OcrAccountContext[]
): string {
  let prompt = `Kamu adalah asisten OCR cerdas untuk struk transaksi digital dan fisik di Indonesia.
Ekstrak informasi transaksi berikut secara akurat:
1. amount: Total pembayaran/tagihan akhir yang dibayar pengguna (integer rupiah positif utuh).
   - UTAMAKAN "Total Pembayaran", "Total Tagihan", atau "Total Akhir" di bagian bawah struk, BUKAN harga barang satuan atau subtotal.
   - PENTING: Titik (.) dalam mata uang Rupiah adalah pemisah ribuan, BUKAN desimal! Contoh: "116.000" berarti 116000 (seratus enam belas ribu rupiah), JANGAN PERNAH mengembalikan 116! Begitu juga "150.000" adalah 150000.
2. date: Tanggal transaksi format YYYY-MM-DD. Jika tidak ada tahun, gunakan tahun ini. Null jika tidak tertera.
3. merchant: Nama resto/toko/penerima transfer/tujuan tagihan (bersihkan dari nomor rekening atau ID transaksi panjang).
4. platform: Salah satu dari "shopeefood", "gofood", "spaylater", "tiktok", "bank_jago", "qris", atau "other".
5. paymentMethod: Metode pembayaran riil yang tertera (contoh: "Shopee Paylater", "GoPay", "Saldo Jago", "QRIS BCA").
6. suggestedType: "transfer" jika struk adalah pelunasan tagihan paylater/kartu kredit atau kirim uang antar bank; "expense" jika pembelian barang/makanan/jasa.
7. confidence: "high" jika angka total dan informasi terbaca jelas, "low" jika pudar/buram/meragukan.`;

  if (categories && categories.length > 0) {
    prompt += `\n\nPilihlah categoryId yang PALING TEPAT dari daftar kategori pengguna berikut:\n` +
      categories.map((c) => `- ID: "${c.id}", Nama: "${c.name}", Tipe: "${c.type}"`).join('\n') +
      `\nAturan Kategori:\n- Jika struk ShopeeFood / GoFood / resto / kafe: prioritaskan kategori makanan/minuman (expense).\n- Jika struk belanja pakaian/barang: pilih kategori belanja (expense).\n- Jika struk tagihan listrik/air/utilitas: pilih kategori tagihan/utilitas.\n- Jika tidak ada yang cocok, isi null.`;
  } else {
    prompt += `\ncategoryId: isi null jika tidak ada daftar kategori.`;
  }

  if (accounts && accounts.length > 0) {
    prompt += `\n\nPilihlah accountId yang PALING TEPAT dari daftar akun/rekening pengguna berikut:\n` +
      accounts.map((a) => `- ID: "${a.id}", Nama: "${a.name}", Tipe: "${a.kind}"`).join('\n') +
      `\nAturan Akun:\n- Jika pembayaran menggunakan PayLater (SPayLater, TikTok Paylater) dan pengguna memiliki akun bertipe "liability" yang sesuai, pilih ID akun tersebut.\n- Jika struk dari Bank Jago, pilih akun Bank Jago.\n- Jika tidak ada akun yang cocok persis, pilih akun utama pertama atau isi null.`;
  } else {
    prompt += `\naccountId: isi null jika tidak ada daftar akun.`;
  }

  return prompt;
}

export function getGeminiModel(
  modelName: string = DEFAULT_OCR_MODEL,
  categories?: OcrCategoryContext[],
  accounts?: OcrAccountContext[]
) {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: modelName,
    systemInstruction: buildOcrSystemInstruction(categories, accounts),
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          amount: {
            type: SchemaType.INTEGER,
            description: 'Nominal total akhir rupiah integer positif utuh tanpa titik desimal (contoh: 150000, 116000, bukan 150 atau 116)',
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
          categoryId: {
            type: SchemaType.STRING,
            description: 'ID kategori yang paling cocok dari daftar pengguna',
            nullable: true,
          },
          accountId: {
            type: SchemaType.STRING,
            description: 'ID akun yang paling cocok dari daftar pengguna',
            nullable: true,
          },
          platform: {
            type: SchemaType.STRING,
            enum: ['shopeefood', 'gofood', 'spaylater', 'tiktok', 'bank_jago', 'qris', 'other'],
            description: 'Platform asal struk',
          },
          paymentMethod: {
            type: SchemaType.STRING,
            description: 'Metode pembayaran riil tertera di struk',
            nullable: true,
          },
          suggestedType: {
            type: SchemaType.STRING,
            enum: ['expense', 'transfer'],
            description: 'Saran jenis transaksi (expense untuk belanja, transfer untuk bayar tagihan/kirim uang)',
          },
        },
        required: ['amount', 'confidence'],
      },
    },
  });
}

export async function scanReceiptWithGemini(
  blobOrBlobs: Blob | Blob[],
  uid: string,
  options: ScanOptions = {}
): Promise<OcrReceiptResult> {
  const { timeoutMs = 60000, signal, modelName = DEFAULT_OCR_MODEL, categories, accounts } = options;

  // 1. Pre-check quota BEFORE invoking AI (do not increment yet)
  await checkScanQuota(uid);

  // 2. Prepare parts & model
  const blobs = Array.isArray(blobOrBlobs) ? blobOrBlobs : [blobOrBlobs];
  const imageParts = await Promise.all(blobs.map((b) => blobToGenerativePart(b)));
  const model = getGeminiModel(modelName, categories, accounts);

  const promptText = blobs.length > 1
    ? 'Berikut adalah gambar struk transaksi yang terdiri dari beberapa tangkapan layar berurutan dari 1 transaksi yang sama (misal tangkapan layar atas berisi nama produk/merchant, dan tangkapan layar bawah berisi rincian pembayaran serta total akhir). Satukan informasi ini dan ekstrak sesuai JSON schema.'
    : 'Ekstrak informasi struk transaksi ini sesuai JSON schema.';

  // 3. Request with timeout
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Waktu pemrosesan struk habis (timeout). Silakan coba lagi.'));
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
    let res;
    try {
      res = await model.generateContent([
        ...imageParts,
        promptText,
      ]);
    } catch (err: unknown) {
      if (modelName === DEFAULT_OCR_MODEL && !signal?.aborted) {
        // Fallback to gemini-3.5-flash if lite encounters an issue
        const fallbackModel = getGeminiModel(FALLBACK_OCR_MODEL);
        res = await fallbackModel.generateContent([
          ...imageParts,
          promptText,
        ]);
      } else {
        throw err;
      }
    }

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
