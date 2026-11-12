/** Mengunduh teks sebagai berkas lewat tautan sementara. */
export function downloadTextFile(fileName: string, text: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Beri waktu browser memulai unduhan sebelum URL dilepas
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
