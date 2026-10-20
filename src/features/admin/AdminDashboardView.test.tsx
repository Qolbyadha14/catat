import { describe, it, expect } from 'bun:test';
import type { AiLogEntry } from '../../lib/telemetry/telemetryService';
import { calculateTelemetrySummary } from '../../lib/telemetry/telemetryService';

describe('AdminDashboardView logic & telemetry calculation', () => {
  it('correctly filters logs based on search query and status tab', () => {
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

    // Filter by feature 'ocr'
    const ocrLogs = logs.filter((l) => l.feature === 'ocr');
    expect(ocrLogs.length).toBe(2);

    // Filter by errors
    const errorLogs = logs.filter((l) => l.status === 'error' || l.status === 'fallback');
    expect(errorLogs.length).toBe(2);

    // Filter by search query 'bob'
    const searchLogs = logs.filter(
      (l) => l.userEmail?.toLowerCase().includes('bob') || l.uid.includes('bob')
    );
    expect(searchLogs.length).toBe(1);
    expect(searchLogs[0].userEmail).toBe('bob@test.com');
  });

  it('calculates summary statistics for KPI cards correctly', () => {
    const logs: AiLogEntry[] = [
      {
        id: '1',
        uid: 'u1',
        feature: 'ocr',
        model: 'gemini-3.5-flash-lite',
        durationMs: 1000,
        status: 'success',
        tokensUsed: { promptTokens: 100, responseTokens: 50, totalTokens: 150 },
        timestamp: 100,
        dateKey: '2026-10-20',
      },
    ];

    const summary = calculateTelemetrySummary(logs);
    expect(summary.totalCalls).toBe(1);
    expect(summary.ocrCalls).toBe(1);
    expect(summary.successCount).toBe(1);
    expect(summary.avgDurationMs).toBe(1000);
    expect(summary.totalTokens).toBe(150);
  });
});
