export interface ResizedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

export function calculateDimensions(
  width: number,
  height: number,
  maxEdge = 1600
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }
  if (width <= maxEdge && height <= maxEdge) {
    return { width, height };
  }
  if (width >= height) {
    const scale = maxEdge / width;
    return {
      width: maxEdge,
      height: Math.round(height * scale),
    };
  }
  const scale = maxEdge / height;
  return {
    width: Math.round(width * scale),
    height: maxEdge,
  };
}

export async function resizeImage(
  file: Blob | File,
  maxEdge = 1600,
  quality = 0.8
): Promise<ResizedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = calculateDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context tidak tersedia'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal mengonversi gambar ke Blob'));
            return;
          }
          resolve({
            blob,
            dataUrl,
            width,
            height,
          });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal memuat file gambar struk'));
    };

    img.src = objectUrl;
  });
}
