export interface ParsedReceipt {
  amount: number | null;
  date: string | null; // Format 'YYYY-MM-DD'
  merchant: string | null;
  confidence: number; // 0 - 100
  needsReview: boolean; // true if confidence < 60 or amount missing
  rawLines: string[];
}

/**
 * Normalizes Indonesian currency string into positive integer number.
 * Handles:
 * - 'Rp 45.000', '45.000,00', '45,000.00', '45.000,-', '45000'
 * - Common OCR substitutions like 'O'/'o' for '0'
 */
export function normalizeCurrency(raw: string): number | null {
  if (!raw) return null;

  let clean = raw.trim();

  // If starts with Rp / RP / rp / IDR
  clean = clean.replace(/^(?:rp\.?|idr)\s*/i, '');

  // Strip trailing dashes/equals often seen in '45.000,-'
  clean = clean.replace(/[-=]+$/, '').trim();

  // Replace 'O' or 'o' with '0'
  clean = clean.replace(/[oO]/g, '0');

  // Format A: '15.000,00' or '1.250.000,50' (dot thousands, comma decimals)
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(clean)) {
    const part = clean.split(',')[0];
    if (!part) return null;
    const withoutThousands = part.replace(/\./g, '');
    const num = parseInt(withoutThousands, 10);
    return isNaN(num) ? null : num;
  }

  // Format B: '15,000.00' or '1,250,000.50' (comma thousands, dot decimals)
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(clean)) {
    const part = clean.split('.')[0];
    if (!part) return null;
    const withoutThousands = part.replace(/,/g, '');
    const num = parseInt(withoutThousands, 10);
    return isNaN(num) ? null : num;
  }

  // Format C: '15.000' or '15,000' without extra decimals
  if (/^\d{1,3}[.,]\d{3}$/.test(clean)) {
    const num = parseInt(clean.replace(/[.,]/g, ''), 10);
    return isNaN(num) ? null : num;
  }

  // Format D: Multiple dots/commas e.g. '1.500.000' or '1,500,000'
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(clean)) {
    const num = parseInt(clean.replace(/[.,]/g, ''), 10);
    return isNaN(num) ? null : num;
  }

  // Format E: Simple integers '45000'
  const digitsOnly = clean.replace(/[^\d]/g, '');
  if (digitsOnly.length >= 3 && digitsOnly.length <= 10) {
    const num = parseInt(digitsOnly, 10);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Parses date from string to YYYY-MM-DD
 */
export function extractDate(line: string): string | null {
  // Regex 1: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = line.match(/\b([0-3]?\d)[/.-]([0-1]?\d)[/.-](20\d{2}|\d{2})\b/);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Regex 2: YYYY-MM-DD
  const ymdMatch = line.match(/\b(20\d{2})[/.-]([0-1]?\d)[/.-]([0-3]?\d)\b/);
  if (ymdMatch && ymdMatch[1] && ymdMatch[2] && ymdMatch[3]) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Regex 3: DD Mon YYYY (Indonesian / English month names)
  const monthMap: Record<string, string> = {
    jan: '01', januari: '01', january: '01',
    feb: '02', februari: '02', february: '02',
    mar: '03', maret: '03', march: '03',
    apr: '04', april: '04',
    mei: '05', may: '05',
    jun: '06', juni: '06', june: '06',
    jul: '07', juli: '07', july: '07',
    agu: '08', agustus: '08', aug: '08', august: '08',
    sep: '09', september: '09',
    okt: '10', oktober: '10', oct: '10', october: '10',
    nov: '11', november: '11',
    des: '12', desember: '12', dec: '12', december: '12',
  };

  const textMonthMatch = line.match(/\b([0-3]?\d)\s+([a-zA-Z]{3,9})\s+(20\d{2})\b/i);
  if (textMonthMatch && textMonthMatch[1] && textMonthMatch[2] && textMonthMatch[3]) {
    const day = parseInt(textMonthMatch[1], 10);
    const mStr = textMonthMatch[2].toLowerCase();
    const year = parseInt(textMonthMatch[3], 10);
    const month = monthMap[mStr];
    if (month && day >= 1 && day <= 31) {
      return `${year}-${month}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Parses raw OCR text of receipt into structured transaction data.
 */
export function parseReceipt(rawText: string): ParsedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let detectedAmount: number | null = null;
  let detectedDate: string | null = null;
  let detectedMerchant: string | null = null;
  let foundTotalKeyword = false;

  // Patterns for lines that MUST NOT be considered as final total
  const excludeKeywords = [
    /\btunai\b/i,
    /\bcash\b/i,
    /\bdibayar\b/i,
    /\bbayar\b/i,
    /\bkembali(?:an)?\b/i,
    /\bchange\b/i,
    /\bdiskon\b/i,
    /\bpotongan\b/i,
    /\bhemat\b/i,
    /\bpembulatan\b/i,
    /\bdisc\b/i,
    /\bsubtotal\b/i,
    /\bsub[- ]total\b/i,
    /\bdpp\b/i,
    /\bppn\b/i,
    /\bpb1\b/i,
    /\bservice\b/i,
    /\bpajak\b/i,
    /\btotal\s+(?:item|qty|pcs|barang|diskon|hemat)\b/i,
    /\bqty\b/i,
    /\bitems?\b/i,
    /\btelp\b/i,
    /\bphone\b/i,
    /\bnpwp\b/i,
    /\bmeja\b/i,
    /\btable\b/i,
  ];

  // Strong total patterns (support OCR noise like T0TAL)
  const totalKeywords = [
    /\bgrand\s*t[o0]tal\b/i,
    /\bt[o0]tal\s*bayar\b/i,
    /\bt[o0]tal\s*akhir\b/i,
    /\bt[o0]tal\s*tagihan\b/i,
    /\bt[o0]tal\s*belanja\b/i,
    /\bt[o0]tal\s*harga\b/i,
    /\bt[o0]tal\b/i,
    /\btagihan\b/i,
    /\bjumlah\b/i,
  ];

  // Helper to extract numeric candidate from a line
  const extractAmountFromLine = (line: string): number | null => {
    const matches = line.match(/(?:rp\.?|idr)?\s*[\dO][\dO.,]{2,}[\dO]|-?\s*[\dO.,]+,-/gi);
    if (!matches) return null;

    for (let i = matches.length - 1; i >= 0; i--) {
      const matchStr = matches[i];
      if (!matchStr) continue;
      const val = normalizeCurrency(matchStr);
      if (val && val >= 100 && val <= 100_000_000) {
        return val;
      }
    }
    return null;
  };

  // 1. Merchant Detection: Check top 6 lines for first valid brand/store text
  const invalidMerchantPatterns = [
    /struk/i,
    /pembayaran/i,
    /salinan/i,
    /receipt/i,
    /invoice/i,
    /tagihan/i,
    /jl\./i,
    /jalan/i,
    /telp/i,
    /phone/i,
    /npwp/i,
    /kasir/i,
    /pos\b/i,
    /\d{4}/,
  ];

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const l = lines[i];
    if (l && l.length >= 3 && l.length <= 40) {
      const isInvalid = invalidMerchantPatterns.some((p) => p.test(l));
      if (!isInvalid && /[a-zA-Z]{3,}/.test(l)) {
        detectedMerchant = l.replace(/[^a-zA-Z0-9\s&.-]/g, '').trim();
        break;
      }
    }
  }

  // 2. Date Detection: scan all lines
  for (const line of lines) {
    if (!detectedDate) {
      const d = extractDate(line);
      if (d) {
        detectedDate = d;
      }
    }
  }

  // 3. Amount Detection:
  // Step 3a: Prioritize lines matching totalKeywords (reverse scan to get final total if multiple)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;

    const isExcluded = excludeKeywords.some((p) => p.test(line));
    if (isExcluded) continue;

    const isTotal = totalKeywords.some((p) => p.test(line));
    if (isTotal) {
      const amt = extractAmountFromLine(line);
      if (amt !== null) {
        detectedAmount = amt;
        foundTotalKeyword = true;
        break;
      } else {
        // Amount might be on the next line
        const nextLine = lines[i + 1];
        if (nextLine) {
          const nextAmt = extractAmountFromLine(nextLine);
          if (nextAmt !== null) {
            detectedAmount = nextAmt;
            foundTotalKeyword = true;
            break;
          }
        }
      }
    }
  }

  // Step 3b: Fallback if no TOTAL line found
  if (detectedAmount === null) {
    let maxCandidate: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (/\btunai\b|\bcash\b|\bkembali\b|\bchange\b/i.test(line)) {
        break;
      }

      if (excludeKeywords.some((p) => p.test(line))) {
        continue;
      }

      const amt = extractAmountFromLine(line);
      if (amt !== null) {
        if (maxCandidate === null || amt > maxCandidate) {
          maxCandidate = amt;
        }
      }
    }

    if (maxCandidate !== null) {
      detectedAmount = maxCandidate;
    }
  }

  // 4. Confidence scoring
  let score = 0;
  if (detectedAmount !== null) {
    score += foundTotalKeyword ? 50 : 25;
  }
  if (detectedDate !== null) {
    score += 30;
  }
  if (detectedMerchant !== null) {
    score += 20;
  }

  const confidence = Math.min(100, score);
  const needsReview = confidence < 60 || detectedAmount === null;

  return {
    amount: detectedAmount,
    date: detectedDate,
    merchant: detectedMerchant,
    confidence,
    needsReview,
    rawLines: lines,
  };
}
