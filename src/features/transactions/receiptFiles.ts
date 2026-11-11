import { validateReceiptFile } from '../../lib/ocrService';

export const MAX_BATCH_FILES = 10;

export function validateBatchFiles(files: File[]): { valid: boolean; error?: string } {
  if (!files || files.length === 0) {
    return { valid: false, error: 'Pilih minimal 1 file gambar struk.' };
  }
  if (files.length > MAX_BATCH_FILES) {
    return {
      valid: false,
      error: `Maksimal ${MAX_BATCH_FILES} struk sekaligus per upload (Anda memilih ${files.length} file).`,
    };
  }
  for (const file of files) {
    const res = validateReceiptFile(file);
    if (!res.valid) {
      return {
        valid: false,
        error: `File "${file.name}": ${res.error ?? 'tidak valid.'}`,
      };
    }
  }
  return { valid: true };
}

export function checkBatchQuota(
  remaining: number,
  fileCount: number,
  mode: 'combine' | 'bulk'
): { allowed: boolean; error?: string } {
  const needed = mode === 'combine' ? 1 : fileCount;
  if (remaining < needed) {
    const error =
      mode === 'combine'
        ? 'Batas kuota harian tercapai. Silakan input transaksi manual.'
        : `Sisa kuota harian (${remaining}) tidak mencukupi untuk memindai ${fileCount} struk sekaligus.`;
    return { allowed: false, error };
  }
  return { allowed: true };
}

export function extractImageFilesFromClipboard(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];
  const files: File[] = [];

  if (clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (file && file.type.startsWith('image/')) {
        files.push(file);
      }
    }
  }

  if (files.length === 0 && clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }

  return files;
}

export function extractImageFileFromClipboard(clipboardData: DataTransfer | null): File | null {
  const files = extractImageFilesFromClipboard(clipboardData);
  return files[0] ?? null;
}
