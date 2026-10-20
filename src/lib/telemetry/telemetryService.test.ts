import {
  calculateTelemetrySummary,
  formatTelemetryDateKey,
  type AiLogEntry,
} from './telemetryService';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// 1. Date key formatting
const fixedDate = new Date(2026, 9, 20);
assert(formatTelemetryDateKey(fixedDate) === '2026-10-20', 'formatTelemetryDateKey returns YYYY-MM-DD');

// 2. Summary calculation
const sampleLogs: AiLogEntry[] = [
  {
    id: '1',
    uid: 'user-1',
    feature: 'ocr',
    model: 'gemini-3.5-flash-lite',
    durationMs: 1200,
    status: 'success',
    tokensUsed: { promptTokens: 300, responseTokens: 100, totalTokens: 400 },
    timestamp: 1774000000000,
    dateKey: '2026-10-20',
  },
  {
    id: '2',
    uid: 'user-2',
    feature: 'ocr',
    model: 'gemini-3.5-flash',
    durationMs: 2000,
    status: 'fallback',
    tokensUsed: { promptTokens: 400, responseTokens: 200, totalTokens: 600 },
    timestamp: 1774000010000,
    dateKey: '2026-10-20',
  },
  {
    id: '3',
    uid: 'user-1',
    feature: 'nlp',
    model: 'gemini-3.5-flash-lite',
    durationMs: 400,
    status: 'error',
    errorMsg: 'Timeout connecting to Gemini',
    timestamp: 1774000020000,
    dateKey: '2026-10-20',
  },
  {
    id: '4',
    uid: 'user-3',
    feature: 'nlp',
    model: 'gemini-3.5-flash-lite',
    durationMs: 400,
    status: 'success',
    tokensUsed: { totalTokens: 150 },
    timestamp: 1774000030000,
    dateKey: '2026-10-20',
  },
];

const summary = calculateTelemetrySummary(sampleLogs);
assert(summary.totalCalls === 4, 'totalCalls is 4');
assert(summary.ocrCalls === 2, 'ocrCalls is 2');
assert(summary.nlpCalls === 2, 'nlpCalls is 2');
assert(summary.successCount === 2, 'successCount is 2');
assert(summary.fallbackCount === 1, 'fallbackCount is 1');
assert(summary.errorCount === 1, 'errorCount is 1');
assert(summary.avgDurationMs === 1000, 'avgDurationMs is 1000');
assert(summary.totalTokens === 1150, 'totalTokens is 1150');

// 3. Empty logs check
const emptySummary = calculateTelemetrySummary([]);
assert(emptySummary.totalCalls === 0, 'empty logs totalCalls is 0');
assert(emptySummary.ocrCalls === 0, 'empty logs ocrCalls is 0');
assert(emptySummary.avgDurationMs === 0, 'empty logs avgDurationMs is 0');
assert(emptySummary.totalTokens === 0, 'empty logs totalTokens is 0');

console.log('telemetryService asserts pass');
