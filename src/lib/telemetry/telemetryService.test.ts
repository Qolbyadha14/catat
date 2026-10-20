import { describe, it, expect } from 'bun:test';
import {
  calculateTelemetrySummary,
  formatTelemetryDateKey,
  type AiLogEntry,
} from './telemetryService';

describe('telemetryService', () => {
  it('formats telemetry date key correctly', () => {
    const fixedDate = new Date(2026, 9, 20); // Oct 20, 2026
    expect(formatTelemetryDateKey(fixedDate)).toBe('2026-10-20');
  });

  it('calculates summary metrics accurately from log entries', () => {
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

    expect(summary.totalCalls).toBe(4);
    expect(summary.ocrCalls).toBe(2);
    expect(summary.nlpCalls).toBe(2);
    expect(summary.successCount).toBe(2);
    expect(summary.fallbackCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    // Average duration: (1200 + 2000 + 400 + 400) / 4 = 1000
    expect(summary.avgDurationMs).toBe(1000);
    // Total tokens: 400 + 600 + 0 + 150 = 1150
    expect(summary.totalTokens).toBe(1150);
  });

  it('handles empty logs gracefully in calculateTelemetrySummary', () => {
    const summary = calculateTelemetrySummary([]);
    expect(summary.totalCalls).toBe(0);
    expect(summary.ocrCalls).toBe(0);
    expect(summary.nlpCalls).toBe(0);
    expect(summary.avgDurationMs).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });
});
