import { validateReceiptFile, MAX_FILE_SIZE_BYTES } from './ocrService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// 1. Valid files
{
  const validFile = new File(['dummy content'], 'struk.jpg', { type: 'image/jpeg' });
  const res = validateReceiptFile(validFile);
  assert(res.valid === true, 'struk.jpg should be valid');
}

{
  const pngFile = new File(['dummy content'], 'receipt.png', { type: 'image/png' });
  const res = validateReceiptFile(pngFile);
  assert(res.valid === true, 'receipt.png should be valid');
}

// 2. Reject HEIC
{
  const heicFile = new File(['dummy content'], 'photo.heic', { type: 'image/heic' });
  const res = validateReceiptFile(heicFile);
  assert(res.valid === false, 'HEIC should be rejected');
  assert(res.error?.includes('HEIC') === true, 'Error should mention HEIC');
}

// 3. Reject Oversized (>20MB)
{
  // Mock file size > 20MB
  const bigBlob = new Uint8Array(MAX_FILE_SIZE_BYTES + 1024);
  const bigFile = new File([bigBlob], 'huge.jpg', { type: 'image/jpeg' });
  const res = validateReceiptFile(bigFile);
  assert(res.valid === false, 'Oversized file should be rejected');
  assert(res.error?.includes('20MB') === true, 'Error should mention 20MB');
}

// 4. Reject Non-image
{
  const pdfFile = new File(['dummy pdf'], 'doc.pdf', { type: 'application/pdf' });
  const res = validateReceiptFile(pdfFile);
  assert(res.valid === false, 'PDF should be rejected');
}

console.log('ocrService validation tests pass');
