/**
 * Firestore menolak nilai `undefined` di mana pun (field, objek bersarang, isi array).
 * zod mempertahankan key opsional yang bernilai undefined, jadi data yang sudah divalidasi
 * tetap harus dibersihkan sebelum ditulis. Objek polos dan array diproses rekursif; tipe lain
 * (Date, Timestamp, FieldValue, dsb.) dibiarkan apa adanya.
 */
export function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item)) as T;
  }
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = omitUndefinedDeep(item);
    }
    return out as T;
  }
  return value;
}
