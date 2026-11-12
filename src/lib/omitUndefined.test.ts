import { describe, expect, test } from 'bun:test';
import { omitUndefinedDeep } from './omitUndefined';

describe('omitUndefinedDeep', () => {
  test('membuang key undefined di level atas dan bersarang', () => {
    const out = omitUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: 2 }, f: [{ g: undefined, h: 3 }] });
    expect(out as unknown).toEqual({ a: 1, c: { e: 2 }, f: [{ h: 3 }] });
    expect(Object.keys(out)).toEqual(['a', 'c', 'f']);
    expect('d' in out.c).toBe(false);
  });

  test('mempertahankan null, 0, string kosong, dan false', () => {
    expect(omitUndefinedDeep({ a: null, b: 0, c: '', d: false })).toEqual({ a: null, b: 0, c: '', d: false });
  });

  test('tidak mengubah objek asli', () => {
    const input = { a: undefined, b: { c: undefined } };
    omitUndefinedDeep(input);
    expect('a' in input).toBe(true);
    expect('c' in input.b).toBe(true);
  });

  test('instance non-polos (Date, class) dibiarkan', () => {
    const date = new Date(5);
    class Marker {
      x = undefined;
    }
    const marker = new Marker();
    const out = omitUndefinedDeep({ date, marker });
    expect(out.date).toBe(date);
    expect(out.marker).toBe(marker);
  });

  test('nilai primitif dan array kosong aman', () => {
    expect(omitUndefinedDeep(5)).toBe(5);
    expect(omitUndefinedDeep(null)).toBeNull();
    expect(omitUndefinedDeep([])).toEqual([]);
  });
});
