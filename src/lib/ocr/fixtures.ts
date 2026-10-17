/**
 * Matriks 10 Fixture Struk untuk Evaluasi Akurasi OCR & Parser
 */

export interface ReceiptFixture {
  id: string;
  name: string;
  category: 'supermarket' | 'minimarket' | 'fnb' | 'transport' | 'high_value' | 'degraded' | 'edge_case';
  rawText: string;
  expected: {
    amount: number | null;
    date: string | null;
    merchant: string | null;
    confidence: 'high' | 'low';
    shouldRejectOrFallback: boolean;
  };
}

export const RECEIPT_FIXTURES: ReceiptFixture[] = [
  // 1. Indomaret: format standar belanja minimarket
  {
    id: 'fix-01-indomaret',
    name: 'Indomaret Point Sudirman',
    category: 'minimarket',
    rawText: `
INDOMARET POINT
PT INDOMARCO PRISMATAMA
JL. JEND SUDIRMAN KAV 45 JAKARTA
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
TERIMA KASIH TELAH BERBELANJA
`,
    expected: {
      amount: 45000,
      date: '2026-10-15',
      merchant: 'INDOMARET POINT',
      confidence: 'high',
      shouldRejectOrFallback: false,
    },
  },

  // 2. Alfamart: desimal ,00 dan diskon promo
  {
    id: 'fix-02-alfamart',
    name: 'Alfamart Ciputat Raya',
    category: 'minimarket',
    rawText: `
ALFAMART CIPUTAT RAYA
PT SUMBER ALFARIA TRIJAYA TBK
NPWP: 01.324.567.8-012.000
2026-10-16 09:12
--------------------------------
MINYAK GORENG 2L        34.500,00
GULA PASIR 1KG          17.500,00
TOTAL                   52.000,00
CASH                   100.000,00
KEMBALI                 48.000,00
TOTAL ITEM: 2
`,
    expected: {
      amount: 52000,
      date: '2026-10-16',
      merchant: 'ALFAMART CIPUTAT RAYA',
      confidence: 'high',
      shouldRejectOrFallback: false,
    },
  },

  // 3. Resto ber-PPN 10% + Service Charge 5%
  {
    id: 'fix-03-resto-tax',
    name: 'Resto Kopi Kenangan Mall Kelapa Gading',
    category: 'fnb',
    rawText: `
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
`,
    expected: {
      amount: 69300,
      date: '2026-10-14',
      merchant: 'KOPI KENANGAN MANTAN',
      confidence: 'high',
      shouldRejectOrFallback: false,
    },
  },

  // 4. SPBU Pertamina: font dot-matrix, bedakan volume liter vs nominal rupiah
  {
    id: 'fix-04-spbu',
    name: 'SPBU Pertamina 31.124.02',
    category: 'transport',
    rawText: `
SPBU PERTAMINA 31.124.02
JL. MT HARYONO KAV 18
JAKARTA SELATAN
TANGGAL: 16-10-2026 08:30
POMPA : 03
PRODUK: PERTAMAX
LITER : 25.00 L
HARGA/LITER : Rp 12.950
TOTAL RP : Rp 323.750
TUNAI    : Rp 350.000
KEMBALI  : Rp  26.250
TERIMA KASIH
`,
    expected: {
      amount: 323750,
      date: '2026-10-16',
      merchant: 'SPBU PERTAMINA',
      confidence: 'high',
      shouldRejectOrFallback: false,
    },
  },

  // 5. Struk belanja nominal 8 digit (> Rp 10.000.000)
  {
    id: 'fix-05-high-value',
    name: 'iBox Store Central Park',
    category: 'high_value',
    rawText: `
IBOX CENTRAL PARK
PT ERALINK LESTARI
INV: IBX-20261017-0881
DATE: 2026-10-17 11:15
--------------------------------
MACBOOK AIR M3 16GB     18.499.000
APPLECARE+ PROTECTION    3.299.000
SUBTOTAL                21.798.000
PPN 11% (INCLUDED)               0
TOTAL PEMBAYARAN        21.798.000
DEBIT BCA               21.798.000
CHANGE                           0
`,
    expected: {
      amount: 21798000,
      date: '2026-10-17',
      merchant: 'IBOX CENTRAL PARK',
      confidence: 'high',
      shouldRejectOrFallback: false,
    },
  },

  // 6. Thermal pudar: kontras rendah dan degradasi karakter
  {
    id: 'fix-06-faded-thermal',
    name: 'Warung Makan Padang Sederhana (Pudar)',
    category: 'degraded',
    rawText: `
RM PADANG AMBO JAYA
12/10/2026
NASI RENDANG           28.OOO
ES JERUK                7.OOO
T0TAL                  35.OOO
TUNAI                  5O.OOO
KEMBALI                15.OOO
`,
    expected: {
      amount: 35000,
      date: '2026-10-12',
      merchant: 'RM PADANG AMBO JAYA',
      confidence: 'low',
      shouldRejectOrFallback: false,
    },
  },

  // 7. Struk miring 45 derajat dengan noise ekstra
  {
    id: 'fix-07-skewed',
    name: 'FamilyMart Stasiun Manggarai (Miring)',
    category: 'degraded',
    rawText: `
    ~ FAMILYMART MANGGARAI ~
        15 Okt 2026 18:05
  KOPI SUSU KELUARGA     15.000
  CRISPY CHICKEN         18.000
  TOTAL                  33.000
  GOPAY                  33.000
    TERIMA KASIH ATAS KUNJUNGAN
`,
    expected: {
      amount: 33000,
      date: '2026-10-15',
      merchant: 'FAMILYMART MANGGARAI',
      confidence: 'high',
      shouldRejectOrFallback: false,
    },
  },

  // 8. Foto blur / teks tidak terbaca
  {
    id: 'fix-08-blurred',
    name: 'Struk Blur Buram Tak Terbaca',
    category: 'edge_case',
    rawText: `
-- BLURRED IMAGE --
... xxxx ... ??? ...
... ---- ...
~~~ #### ~~~
`,
    expected: {
      amount: null,
      date: null,
      merchant: null,
      confidence: 'low',
      shouldRejectOrFallback: true,
    },
  },

  // 9. Foto bukan struk (pemandangan / meja kosong)
  {
    id: 'fix-09-not-a-receipt',
    name: 'Foto Bukan Struk (Kucing Tidur)',
    category: 'edge_case',
    rawText: `
KUCING OREN LUCU TIDUR DI KASUR
TIDAK ADA DATA KEUANGAN SAMA SEKALI
SELAMAT PAGI DUNIA
`,
    expected: {
      amount: null,
      date: null,
      merchant: null,
      confidence: 'low',
      shouldRejectOrFallback: true,
    },
  },

  // 10. Tanggal anomali masa depan / tanggal terpotong
  {
    id: 'fix-10-future-date',
    name: 'Toko Buku Gramedia (Tanggal Salah Cetak 2099)',
    category: 'edge_case',
    rawText: `
GRAMEDIA MATRAMAN
TANGGAL: 2099-12-31 10:00
NOVEL BESTSELLER        98.000
TOTAL                   98.000
QRIS                    98.000
`,
    expected: {
      amount: 98000,
      date: null, // should fallback to reference date/today in parser
      merchant: 'GRAMEDIA MATRAMAN',
      confidence: 'high',
      shouldRejectOrFallback: false,
    },
  },
];
