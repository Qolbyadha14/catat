import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_SYSTEM_CONFIG,
  resolveMergedConfig,
  type SystemConfig,
} from './systemConfigService';

describe('systemConfigService', () => {
  it('has valid default configuration', () => {
    expect(DEFAULT_SYSTEM_CONFIG.dailyOcrLimit).toBe(20);
    expect(DEFAULT_SYSTEM_CONFIG.defaultOcrModel).toBe('gemini-3.5-flash-lite');
    expect(DEFAULT_SYSTEM_CONFIG.fallbackOcrModel).toBe('gemini-3.5-flash');
    expect(DEFAULT_SYSTEM_CONFIG.aiKillSwitch).toBe(false);
  });

  it('correctly merges partial or raw firestore data with defaults', () => {
    const rawData = {
      dailyOcrLimit: 50,
      aiKillSwitch: true,
    };
    const merged = resolveMergedConfig(rawData);
    expect(merged.dailyOcrLimit).toBe(50);
    expect(merged.aiKillSwitch).toBe(true);
    expect(merged.defaultOcrModel).toBe('gemini-3.5-flash-lite');
    expect(merged.fallbackOcrModel).toBe('gemini-3.5-flash');
  });

  it('sanitizes invalid numeric or empty fields', () => {
    const rawData = {
      dailyOcrLimit: -5,
      defaultOcrModel: '',
    };
    const merged = resolveMergedConfig(rawData);
    expect(merged.dailyOcrLimit).toBe(20);
    expect(merged.defaultOcrModel).toBe('gemini-3.5-flash-lite');
  });
});
