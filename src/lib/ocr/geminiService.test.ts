import {
  blobToGenerativePart,
  formatOcrDateKey,
  getGeminiModel,
  DEFAULT_OCR_MODEL,
} from './geminiService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// 1. formatOcrDateKey test
const fixedDate = new Date('2026-10-17T12:00:00Z');
const key = formatOcrDateKey(fixedDate);
assert(key === '2026-10-17', 'formatOcrDateKey returns YYYY-MM-DD');

// 2. blobToGenerativePart test
const textData = 'Hello Receipt';
const blob = new Blob([textData], { type: 'image/jpeg' });
const part = await blobToGenerativePart(blob);
assert(part.type === 'inlineData', 'part type is inlineData');
assert(part.inlineData.mimeType === 'image/jpeg', 'part mimeType matches blob type');
assert(typeof part.inlineData.data === 'string' && part.inlineData.data.length > 0, 'part data is non-empty base64');

// 3. getGeminiModel test: default model
assert(DEFAULT_OCR_MODEL === 'gemini-3.5-flash-lite', 'Default model is gemini-3.5-flash-lite');
const defaultModel = getGeminiModel();
assert(defaultModel.model === 'models/gemini-3.5-flash-lite', 'Default model resolves to models/gemini-3.5-flash-lite');

// 4. Custom model override test
const customModel = getGeminiModel('gemini-1.5-flash');
assert(customModel.model === 'models/gemini-1.5-flash', 'Custom model resolves to models/gemini-1.5-flash');

const config = (defaultModel as unknown as { generationConfig?: Record<string, unknown> }).generationConfig;
if (config) {
  assert(config.temperature === undefined, 'No temperature parameter configured');
  assert(config.topK === undefined, 'No topK parameter configured');
  assert(config.topP === undefined, 'No topP parameter configured');
  assert(config.candidateCount === undefined, 'No candidateCount parameter configured');
  assert(config.responseMimeType === 'application/json', 'Response MIME type is application/json');
}

// 5. Extended Schema: categoryId, accountId, platform, paymentMethod, suggestedType
import { parseOcrReceipt } from './schema';
import { buildOcrSystemInstruction } from './geminiService';

const mockAiOutput = {
  amount: 45000,
  date: '2026-10-19',
  merchant: 'Kopi Kenangan Grand Indonesia',
  confidence: 'high',
  categoryId: 'cat_food_123',
  accountId: 'acc_jago_456',
  platform: 'shopeefood',
  paymentMethod: 'ShopeePay',
  suggestedType: 'expense',
};
const parsed = parseOcrReceipt(mockAiOutput);
assert(parsed.amount === 45000, 'amount parsed correctly');
assert(parsed.categoryId === 'cat_food_123', 'categoryId parsed');
assert(parsed.accountId === 'acc_jago_456', 'accountId parsed');
assert(parsed.platform === 'shopeefood', 'platform parsed');
assert(parsed.paymentMethod === 'ShopeePay', 'paymentMethod parsed');
assert(parsed.suggestedType === 'expense', 'suggestedType parsed');

// 6. buildOcrSystemInstruction generates rich context
const cats = [{ id: 'c1', name: 'Makan & Minum', type: 'expense' as const }];
const accs = [{ id: 'a1', name: 'Bank Jago', kind: 'asset' as const }];
const prompt = buildOcrSystemInstruction(cats, accs);
assert(prompt.includes('Makan & Minum'), 'prompt contains category name');
assert(prompt.includes('Bank Jago'), 'prompt contains account name');
assert(prompt.includes('ShopeeFood'), 'prompt contains platform guidance');

console.log('geminiService unit tests pass');

