/**
 * Utilities for receipt image validation and file constraints.
 */

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function validateReceiptFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Ukuran file melebihi batas 20MB. Perkecil resolusi foto.',
    };
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (name.endsWith('.heic') || name.endsWith('.heif') || type.includes('heic') || type.includes('heif')) {
    return {
      valid: false,
      error: 'Format HEIC/HEIF iPhone tidak didukung secara native. Gunakan JPG atau PNG.',
    };
  }

  if (!type.startsWith('image/') && !/\.(jpe?g|png|webp|bmp)$/i.test(name)) {
    return {
      valid: false,
      error: 'Format berkas tidak valid. Harap unggah foto struk (JPG, PNG, atau WebP).',
    };
  }

  return { valid: true };
}
