import { normalizeCurrency, extractDate, parseReceipt } from './receiptParser';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ==========================================
// 1. Currency Normalizer Unit Tests
// ==========================================
{
  assert(normalizeCurrency('45.000') === 45000, '45.000 -> 45000');
  assert(normalizeCurrency('Rp 45.000') === 45000, 'Rp 45.000 -> 45000');
  assert(normalizeCurrency('Rp. 45.000,00') === 45000, 'Rp. 45.000,00 -> 45000');
  assert(normalizeCurrency('15,000.00') === 15000, '15,000.00 -> 15000');
  assert(normalizeCurrency('1.250.000,-') === 1250000, '1.250.000,- -> 1250000');
  assert(normalizeCurrency('Rp 15.OOO') === 15000, 'OCR O substitution -> 15000');
  assert(normalizeCurrency('75000') === 75000, 'Plain digits -> 75000');
  assert(normalizeCurrency('abc') === null, 'Invalid string -> null');
}

// ==========================================
// 2. Date Extractor Unit Tests
// ==========================================
{
  assert(extractDate('TGL: 16/10/2026 14:30') === '2026-10-16', '16/10/2026 -> 2026-10-16');
  assert(extractDate('Tanggal: 05-08-2025') === '2025-08-05', '05-08-2025 -> 2025-08-05');
  assert(extractDate('2026-12-31') === '2026-12-31', '2026-12-31 -> 2026-12-31');
  assert(extractDate('17 Okt 2026') === '2026-10-17', '17 Okt 2026 -> 2026-10-17');
  assert(extractDate('01 Januari 2025') === '2025-01-01', '01 Januari 2025 -> 2025-01-01');
  assert(extractDate('No date here') === null, 'No date -> null');
}

// ==========================================
// 3. QA Fixture 1: Indomaret
// Uji eliminasi subtotal, diskon, tunai, dan kembalian
// ==========================================
{
  const indomaretReceipt = `
INDOMARET POINT
JL. SUDIRMAN NO. 45 JAKARTA
TGL: 15/10/2026 19:20
--------------------------------
ROTI TAWAR SARI ROTI    15.000
SUSU ULTRA MILK 1L      22.000
SNACK CHITATO           11.500
SUBTOTAL                48.500
DISKON MEMBER           -3.500
TOTAL BELANJA           45.000
TUNAI                   50.000
KEMBALIAN                5.000
--------------------------------
TERIMA KASIH
`;

  const parsed = parseReceipt(indomaretReceipt);
  assert(parsed.amount === 45000, `Indomaret amount should be 45000, got ${parsed.amount}`);
  assert(parsed.date === '2026-10-15', `Indomaret date should be 2026-10-15, got ${parsed.date}`);
  assert(parsed.merchant?.includes('INDOMARET') === true, `Merchant should be Indomaret, got ${parsed.merchant}`);
  assert(parsed.confidence >= 80, `Confidence should be high (>=80), got ${parsed.confidence}`);
  assert(parsed.needsReview === false, 'needsReview should be false');
}

// ==========================================
// 4. QA Fixture 2: Alfamart
// Uji normalisasi desimal format ,00
// ==========================================
{
  const alfamartReceipt = `
ALFAMART CIPUTAT RAYA
NPWP: 01.324.567.8-012.000
2026-10-16 09:12
--------------------------------
MINYAK GORENG 2L        34.500,00
GULA PASIR 1KG          17.500,00
TOTAL                   52.000,00
CASH                   100.000,00
KEMBALI                 48.000,00
TOTAL ITEM: 2
`;

  const parsed = parseReceipt(alfamartReceipt);
  assert(parsed.amount === 52000, `Alfamart amount should be 52000, got ${parsed.amount}`);
  assert(parsed.date === '2026-10-16', `Alfamart date should be 2026-10-16, got ${parsed.date}`);
  assert(parsed.merchant?.includes('ALFAMART') === true, `Merchant should be Alfamart, got ${parsed.merchant}`);
  assert(parsed.confidence >= 80, `Confidence should be >= 80, got ${parsed.confidence}`);
}

// ==========================================
// 5. QA Fixture 3: Resto
// Uji PB1 + service charge sebelum grand total
// ==========================================
{
  const restoReceipt = `
KOPI KENANGAN MANTAN
MALL KELAPA GADING LT. 1
14-10-2026 13:45
MEJA: TAKEAWAY
--------------------------------
2x KOPKEN MANTAN L      48.000
1x ROTI COKLAT KLASIK   12.000
SUBTOTAL                60.000
SERVICE CHARGE 5%        3.000
PB1 RESTO 10%            6.300
GRAND TOTAL             69.300
DIBAYAR QRIS            69.300
KEMBALIAN                    0
`;

  const parsed = parseReceipt(restoReceipt);
  assert(parsed.amount === 69300, `Resto amount should be 69300, got ${parsed.amount}`);
  assert(parsed.date === '2026-10-14', `Resto date should be 2026-10-14, got ${parsed.date}`);
  assert(parsed.merchant?.includes('KOPI KENANGAN') === true, `Merchant should be Kopi Kenangan, got ${parsed.merchant}`);
  assert(parsed.confidence >= 80, `Confidence should be >= 80, got ${parsed.confidence}`);
}

// ==========================================
// 6. QA Fixture 4: Warung thermal pudar
// Uji degradasi teks ber-noise & OCR 'O' vs '0'
// ==========================================
{
  const fadedReceipt = `
WARUNG MAKAN BU JOKO
12/10/2026
NASI RAMES + AYAM      25.OOO
ES TEH MANIS            5.O00
T0TAL                  3O.OOO
TUNAI                  5O.OOO
KEMBALI                2O.OOO
`;

  const parsed = parseReceipt(fadedReceipt);
  assert(parsed.amount === 30000, `Faded receipt amount should be 30000, got ${parsed.amount}`);
  assert(parsed.date === '2026-10-12', `Faded date should be 2026-10-12, got ${parsed.date}`);
  assert(parsed.merchant?.includes('WARUNG') === true, `Merchant should be Warung, got ${parsed.merchant}`);
}

// ==========================================
// 7. QA Fixture 5: Struk minim kata kunci
// Uji fallback saat label TOTAL absen
// ==========================================
{
  const noTotalReceipt = `
BENGKEL MOTOR JAYA
JL RAYA BOGOR KM 28
10 Okt 2026
GANTI OLI MESIN
JASA SERVIS
85.000
`;

  const parsed = parseReceipt(noTotalReceipt);
  assert(parsed.amount === 85000, `Fallback amount should be 85000, got ${parsed.amount}`);
  assert(parsed.date === '2026-10-10', `Fallback date should be 2026-10-10, got ${parsed.date}`);
  assert(parsed.merchant?.includes('BENGKEL') === true, `Merchant should be Bengkel, got ${parsed.merchant}`);
  assert(parsed.needsReview === false, 'needsReview should be false with date+amount+merchant');
}

console.log('receiptParser tests pass (5 QA fixtures 100% nominal match)');
