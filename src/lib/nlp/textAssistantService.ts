import { getAI, getGenerativeModel, GoogleAIBackend, SchemaType } from 'firebase/ai';
import { app } from '../firebase';

export interface TextCategoryContext {
  id: string;
  name: string;
  type: 'expense' | 'income';
}

export interface TextAccountContext {
  id: string;
  name: string;
  kind: 'asset' | 'liability';
}

export interface ParsedTransactionResult {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  date: string;
  description: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  confidence: 'high' | 'low';
  items?: Array<{ name: string; qty?: number; price?: number; subtotal?: number }>;
}

export interface ParseTextOptions {
  categories?: TextCategoryContext[];
  accounts?: TextAccountContext[];
  timeoutMs?: number;
}

/**
 * Parses Indonesian currency amounts:
 * Examples:
 * - "35rb", "35 rb", "12.5rb" -> 35000, 12500
 * - "25k", "50 k", "22.5k" -> 25000, 22500
 * - "8.5jt", "5 jt", "12jt" -> 8500000, 5000000
 * - "150.000", "1.250.000", "50000" -> 150000, 1250000, 50000
 */
export function parseIndonesianAmount(text: string): number | null {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();

  // 1. Juta / Jt (e.g. 8.5jt, 8,5 jt, 8jt)
  const jtMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/);
  if (jtMatch && jtMatch[1]) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1_000_000);
  }

  // 2. Ribu / Rb (e.g. 35rb, 35.5 rb, 35ribu)
  const rbMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)\b/);
  if (rbMatch && rbMatch[1]) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1_000);
  }

  // 3. 'k' suffix (e.g. 25k, 25.5 k)
  const kMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*k\b/);
  if (kMatch && kMatch[1]) {
    const val = parseFloat(kMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1_000);
  }

  // 4. Dot-separated thousands or plain integer (e.g. 150.000, 1.250.000, 50000, Rp 25.000)
  const dotNumberMatch = normalized.match(/(?:rp\.?|idr)?\s*(\d{1,3}(?:\.\d{3})+|\d{4,9})\b/);
  if (dotNumberMatch && dotNumberMatch[1]) {
    const cleaned = dotNumberMatch[1].replace(/\./g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Parses relative Indonesian dates to YYYY-MM-DD
 */
export function parseRelativeDate(text: string): string {
  const now = new Date();
  const lower = (text || '').toLowerCase();

  if (lower.includes('kemarin')) {
    now.setDate(now.getDate() - 1);
  } else if (lower.includes('lusa')) {
    now.setDate(now.getDate() + 2);
  } else if (lower.includes('besok')) {
    now.setDate(now.getDate() + 1);
  }

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Local Heuristic & Regex Parser (Works 100% offline or as AI quota fallback)
 */
export function parseTransactionLocally(
  text: string,
  categories: TextCategoryContext[] = [],
  accounts: TextAccountContext[] = []
): ParsedTransactionResult {
  const lower = text.toLowerCase().trim();
  const amount = parseIndonesianAmount(lower) || 0;
  const date = parseRelativeDate(lower);

  // 1. Transaction Type Detection
  let type: 'expense' | 'income' | 'transfer' = 'expense';
  if (/\b(transfer|tf|kirim\s*uang|pindah\s*dana|top\s*up)\b/.test(lower)) {
    type = 'transfer';
  } else if (/\b(gaji|salary|bonus|pendapatan|masuk|terima|dapat\s*uang|cair|upah)\b/.test(lower)) {
    type = 'income';
  }

  // 2. Account Matching
  let accountId: string | null = null;
  let toAccountId: string | null = null;

  if (accounts.length > 0) {
    if (type === 'transfer') {
      // Check for "dari [acc1] ke [acc2]"
      const transferPattern = /(?:dari|from)\s+([a-z0-9\s_-]+?)\s+(?:ke|to)\s+([a-z0-9\s_-]+)/i;
      const tfMatch = lower.match(transferPattern);
      if (tfMatch) {
        const fromStr = tfMatch[1]?.toLowerCase().trim() || '';
        const toStr = tfMatch[2]?.toLowerCase().trim() || '';
        const matchedFrom = accounts.find((a) => {
          const n = a.name.toLowerCase();
          return fromStr.includes(n) || n.includes(fromStr);
        });
        const matchedTo = accounts.find((a) => {
          if (matchedFrom && a.id === matchedFrom.id) return false;
          const n = a.name.toLowerCase();
          return toStr.includes(n) || n.includes(toStr);
        });
        if (matchedFrom) accountId = matchedFrom.id;
        if (matchedTo) toAccountId = matchedTo.id;
      }
    }

    if (!accountId) {
      // Match any account mentioned in text
      for (const acc of accounts) {
        const nameLower = acc.name.toLowerCase();
        if (lower.includes(nameLower)) {
          accountId = acc.id;
          break;
        }
      }
    }

    // Specific aliases: "spaylater", "paylater", "jago", "bca", "gopay", "ovo", "dana", "cash", "tunai"
    if (!accountId) {
      if (/\b(spaylater|paylater|cicil|later)\b/.test(lower)) {
        const liabilityAcc = accounts.find((a) => a.kind === 'liability' || a.name.toLowerCase().includes('later'));
        if (liabilityAcc) accountId = liabilityAcc.id;
      } else if (/\b(jago|bank\s*jago)\b/.test(lower)) {
        const jagoAcc = accounts.find((a) => a.name.toLowerCase().includes('jago'));
        if (jagoAcc) accountId = jagoAcc.id;
      } else if (/\b(bca)\b/.test(lower)) {
        const bcaAcc = accounts.find((a) => a.name.toLowerCase().includes('bca'));
        if (bcaAcc) accountId = bcaAcc.id;
      } else if (/\b(gopay)\b/.test(lower)) {
        const gopayAcc = accounts.find((a) => a.name.toLowerCase().includes('gopay'));
        if (gopayAcc) accountId = gopayAcc.id;
      } else if (/\b(cash|tunai)\b/.test(lower)) {
        const cashAcc = accounts.find((a) => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('tunai') || a.name.toLowerCase().includes('dompet'));
        if (cashAcc) accountId = cashAcc.id;
      }
    }

    // Fallback to first asset account if not found
    if (!accountId) {
      const defaultAsset = accounts.find((a) => a.kind === 'asset') || accounts[0];
      if (defaultAsset) accountId = defaultAsset.id;
    }
  }

  // 3. Category Matching
  let categoryId: string | null = null;
  const relevantCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));

  // Keywords mapping
  if (type === 'income') {
    const salaryCat = relevantCategories.find((c) => /gaji|salary|pendapatan|income/i.test(c.name));
    if (salaryCat) categoryId = salaryCat.id;
  } else if (type === 'expense') {
    if (/\b(makan|minum|kopi|coffee|resto|warung|padang|cafe|bakso|mie|nasi|food|snack|jajan)\b/.test(lower)) {
      const foodCat = relevantCategories.find((c) => /makan|minum|food/i.test(c.name));
      if (foodCat) categoryId = foodCat.id;
    } else if (/\b(bensin|bbm|pertalite|pertamax|parkir|toll|tol|gojek|grab|ojek|transport)\b/.test(lower)) {
      const transCat = relevantCategories.find((c) => /transport|kendaraan/i.test(c.name));
      if (transCat) categoryId = transCat.id;
    } else if (/\b(listrik|pln|pdam|air|wifi|internet|pulsa|kuota|tagihan|bpjs)\b/.test(lower)) {
      const billCat = relevantCategories.find((c) => /tagihan|utilitas|bill/i.test(c.name));
      if (billCat) categoryId = billCat.id;
    } else if (/\b(belanja|baju|kemeja|celana|sepatu|shopee|tokopedia|tiktok|lazada|mart)\b/.test(lower)) {
      const shopCat = relevantCategories.find((c) => /belanja|shopping/i.test(c.name));
      if (shopCat) categoryId = shopCat.id;
    }
  }

  // Direct category name match
  if (!categoryId && relevantCategories.length > 0) {
    for (const cat of relevantCategories) {
      if (lower.includes(cat.name.toLowerCase())) {
        categoryId = cat.id;
        break;
      }
    }
  }

  // Default category fallback
  if (!categoryId && relevantCategories.length > 0) {
    categoryId = relevantCategories[0]?.id || null;
  }

  // 4. Description Cleaning
  // Extract a readable merchant/note by cleaning common filler words
  let cleanDesc = text
    .replace(/\b(pake|pakai|lewat|via|dari|ke|dengan)\s+[a-z0-9_-]+/gi, '')
    .replace(/\b(kemarin|hari ini|tadi siang|tadi pagi|tadi sore|tadi malam)\b/gi, '')
    .replace(/(?:rp\.?|idr)?\s*(\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)?|\d{1,3}(?:\.\d{3})+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanDesc || cleanDesc.length < 2) {
    cleanDesc = type === 'income' ? 'Pemasukan' : type === 'transfer' ? 'Transfer Saldo' : 'Pengeluaran';
  } else {
    // Capitalize first letter
    cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
  }

  return {
    type,
    amount,
    date,
    description: cleanDesc,
    categoryId,
    accountId,
    toAccountId,
    confidence: amount > 0 && accountId ? 'high' : 'low',
  };
}

/**
 * Gemini AI Structured Parser for Indonesian Transactions
 */
export async function parseTransactionWithGemini(
  text: string,
  categories: TextCategoryContext[] = [],
  accounts: TextAccountContext[] = [],
  modelName: string = 'gemini-3.5-flash-lite'
): Promise<ParsedTransactionResult> {
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  let systemPrompt = `Kamu adalah asisten keuangan cerdas Indonesia yang memahami bahasa percakapan sehari-hari.
Tugasmu adalah mengekstrak data transaksi keuangan secara terstruktur dari kalimat yang diketik pengguna.

Aturan Utama:
1. amount: Total angka rupiah positif integer utuh.
   - Pahami singkatan: 'rb'/'ribu' (x1.000), 'k' (x1.000), 'jt'/'juta' (x1.000.000). Contoh: '35rb' -> 35000, '8.5jt' -> 8500000, '50k' -> 50000.
2. type:
   - 'transfer' jika pengguna memindahkan saldo antar rekening/bank/e-wallet.
   - 'income' jika gaji, bonus, honor, penerimaan dana.
   - 'expense' jika membeli barang/makanan, bayar tagihan/jasa.
3. date: Format YYYY-MM-DD. Tanggal hari ini adalah: ${new Date().toISOString().slice(0, 10)}. Hitung jika pengguna berkata 'kemarin', 'lusa', dsb.
4. description: Nama toko, barang, kegiatan, atau catatan yang ringkas dan bersih.
5. confidence: 'high' jika jelas, 'low' jika ambigu.`;

  if (categories.length > 0) {
    systemPrompt += `\n\nDaftar Kategori Tersedia:\n` +
      categories.map((c) => `- ID: "${c.id}", Nama: "${c.name}", Tipe: "${c.type}"`).join('\n') +
      `\nPilihlah categoryId yang paling tepat.`;
  }

  if (accounts.length > 0) {
    systemPrompt += `\n\nDaftar Akun Tersedia:\n` +
      accounts.map((a) => `- ID: "${a.id}", Nama: "${a.name}", Tipe: "${a.kind}"`).join('\n') +
      `\nPilihlah accountId (dan toAccountId jika transfer) yang paling cocok berdasarkan nama rekening/e-wallet/paylater yang disebut.`;
  }

  const model = getGenerativeModel(ai, {
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            enum: ['expense', 'income', 'transfer'],
          },
          amount: {
            type: SchemaType.INTEGER,
          },
          date: {
            type: SchemaType.STRING,
          },
          description: {
            type: SchemaType.STRING,
          },
          categoryId: {
            type: SchemaType.STRING,
            nullable: true,
          },
          accountId: {
            type: SchemaType.STRING,
            nullable: true,
          },
          toAccountId: {
            type: SchemaType.STRING,
            nullable: true,
          },
          confidence: {
            type: SchemaType.STRING,
            enum: ['high', 'low'],
          },
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                qty: { type: SchemaType.INTEGER, nullable: true },
                price: { type: SchemaType.INTEGER, nullable: true },
                subtotal: { type: SchemaType.INTEGER, nullable: true },
              },
              required: ['name'],
            },
          },
        },
        required: ['type', 'amount', 'date', 'description', 'confidence'],
      },
    },
  });

  const response = await model.generateContent(text);
  const jsonText = response.response.text();
  const parsed = JSON.parse(jsonText) as ParsedTransactionResult;

  return {
    type: parsed.type || 'expense',
    amount: Math.round(parsed.amount || 0),
    date: parsed.date || new Date().toISOString().slice(0, 10),
    description: parsed.description || text.slice(0, 40),
    categoryId: parsed.categoryId || null,
    accountId: parsed.accountId || null,
    toAccountId: parsed.toAccountId || null,
    confidence: parsed.confidence || 'high',
    items: parsed.items || [],
  };
}

/**
 * Main Entry Point: Tries Gemini with timeout, seamlessly falls back to Local NLP
 */
export async function parseTransactionText(
  text: string,
  options: ParseTextOptions = {}
): Promise<ParsedTransactionResult> {
  const { categories = [], accounts = [], timeoutMs = 4000 } = options;

  if (!text || text.trim().length === 0) {
    return parseTransactionLocally('', categories, accounts);
  }

  // Attempt Gemini AI with timeout
  try {
    const aiPromise = parseTransactionWithGemini(text, categories, accounts);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), timeoutMs)
    );

    return await Promise.race([aiPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Gemini text assistant unavailable or timed out, using local parser:', error);
    return parseTransactionLocally(text, categories, accounts);
  }
}
