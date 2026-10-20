import {
  DEFAULT_SYSTEM_CONFIG,
  resolveMergedConfig,
} from './systemConfigService';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// 1. Default config check
assert(DEFAULT_SYSTEM_CONFIG.dailyOcrLimit === 20, 'dailyOcrLimit default is 20');
assert(DEFAULT_SYSTEM_CONFIG.defaultOcrModel === 'gemini-3.5-flash-lite', 'default model is gemini-3.5-flash-lite');
assert(DEFAULT_SYSTEM_CONFIG.fallbackOcrModel === 'gemini-3.5-flash', 'fallback model is gemini-3.5-flash');
assert(DEFAULT_SYSTEM_CONFIG.aiKillSwitch === false, 'aiKillSwitch is false by default');

// 2. Merge check
const rawData = {
  dailyOcrLimit: 50,
  aiKillSwitch: true,
};
const merged = resolveMergedConfig(rawData);
assert(merged.dailyOcrLimit === 50, 'merges dailyOcrLimit correctly');
assert(merged.aiKillSwitch === true, 'merges aiKillSwitch correctly');
assert(merged.defaultOcrModel === 'gemini-3.5-flash-lite', 'keeps default model when unspecified');
assert(merged.fallbackOcrModel === 'gemini-3.5-flash', 'keeps fallback model when unspecified');

// 3. Sanitize check
const invalidData = {
  dailyOcrLimit: -5,
  defaultOcrModel: '',
};
const sanitized = resolveMergedConfig(invalidData);
assert(sanitized.dailyOcrLimit === 20, 'sanitizes negative daily limit to 20');
assert(sanitized.defaultOcrModel === 'gemini-3.5-flash-lite', 'sanitizes empty model to default');

console.log('systemConfigService asserts pass');
