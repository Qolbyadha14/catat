import { blobToGenerativePart, formatOcrDateKey, getGeminiModel } from './geminiService';

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

// 3. getGeminiModel test
const model = getGeminiModel();
assert(model.model === 'models/gemini-3.8-flash', 'Model is models/gemini-3.8-flash');

const config = (model as unknown as { generationConfig?: Record<string, unknown> }).generationConfig;
if (config) {
  assert(config.temperature === undefined, 'No temperature parameter configured');
  assert(config.topK === undefined, 'No topK parameter configured');
  assert(config.topP === undefined, 'No topP parameter configured');
  assert(config.candidateCount === undefined, 'No candidateCount parameter configured');
  assert(config.responseMimeType === 'application/json', 'Response MIME type is application/json');
}

console.log('geminiService unit tests pass');
