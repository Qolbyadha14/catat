import { describe, it, expect } from 'bun:test';
import { playHapticSound } from '../src/lib/haptic';

describe('playHapticSound', () => {
  it('does not throw when executed in test/headless environment', () => {
    expect(() => playHapticSound('click')).not.toThrow();
    expect(() => playHapticSound('success')).not.toThrow();
    expect(() => playHapticSound('tap')).not.toThrow();
    expect(() => playHapticSound('delete')).not.toThrow();
  });
});
