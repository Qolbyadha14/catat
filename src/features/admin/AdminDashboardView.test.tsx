import type { AiLogEntry } from '../../lib/telemetry/telemetryService';
import { calculateTelemetrySummary } from '../../lib/telemetry/telemetryService';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

const logs: AiLogEntry[] = [
  {
    id: '1',
    uid: 'user-a',
    userEmail: 'alice@test.com',
    feature: 'ocr',
    model: 'gemini-3.5-flash-lite',
    durationMs: 800,
    status: 'success',
    timestamp: 1000,
    dateKey: '2026-10-20',
  },
  {
    id: '2',
    uid: 'user-b',
    userEmail: 'bob@test.com',
    feature: 'nlp',
    model: 'gemini-3.5-flash-lite',
    durationMs: 500,
    status: 'fallback',
    errorMsg: 'timeout',
    timestamp: 2000,
    dateKey: '2026-10-20',
  },
  {
    id: '3',
    uid: 'user-c',
    userEmail: 'charlie@test.com',
    feature: 'ocr',
    model: 'gemini-3.5-flash',
    durationMs: 1200,
    status: 'error',
    errorMsg: 'network fail',
    timestamp: 3000,
    dateKey: '2026-10-20',
  },
];

// 1. Filter by feature
const ocrLogs = logs.filter((l) => l.feature === 'ocr');
assert(ocrLogs.length === 2, 'filters 2 OCR logs');

// 2. Filter by errors/fallbacks
const errorLogs = logs.filter((l) => l.status === 'error' || l.status === 'fallback');
assert(errorLogs.length === 2, 'filters 2 error/fallback logs');

// 3. Filter by search query
const searchLogs = logs.filter(
  (l) => l.userEmail?.toLowerCase().includes('bob') || l.uid.includes('bob')
);
assert(searchLogs.length === 1, 'filters 1 log matching bob');
assert(searchLogs[0]?.userEmail === 'bob@test.com', 'matching email is bob@test.com');

// 4. Summary calculation
const summary = calculateTelemetrySummary(logs);
assert(summary.totalCalls === 3, 'summary totalCalls is 3');
assert(summary.ocrCalls === 2, 'summary ocrCalls is 2');
assert(summary.nlpCalls === 1, 'summary nlpCalls is 1');

console.log('AdminDashboardView asserts pass');
