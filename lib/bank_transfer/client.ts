/**
 * Bank Transfer (Banköverföring) — Helper Client
 *
 * No external API — the customer manually transfers money to the dealership's
 * bank account using an OCR reference number for automatic matching.
 *
 * This module provides:
 *   - OCR reference number generation (Luhn-mod10 as per Bankgirot standard)
 *   - IBAN validation for Swedish bank accounts
 *   - Bankgiro number formatting and validation
 *   - Payment instruction text generation for invoices
 *
 * Docs: https://www.bankgirot.se/globalassets/dokument/anvandarmanualer/bankgiro_anvandarmanual_eng.pdf
 *
 * Required env vars:
 *   BANKGIRO_NUMBER   – Your Bankgiro number, e.g. "123-4567"
 *   BANK_ACCOUNT_IBAN – Your IBAN, e.g. "SE4550000000058398257466"
 */

const BANKGIRO = process.env.BANKGIRO_NUMBER    ?? '';
const IBAN     = process.env.BANK_ACCOUNT_IBAN  ?? '';

// ─── OCR reference number generation (Bankgirot standard) ────────────────────

/**
 * Generate a Bankgirot OCR reference number using Luhn mod-10 check digit.
 * Format: {orderId padded to 9 digits}{checkDigit}
 *
 * @param orderId  Your numeric order/invoice ID (e.g. 1234)
 * @returns        OCR reference string (e.g. "0000012345")
 */
export function generateOCR(orderId: number): string {
  const padded = String(orderId).padStart(9, '0');
  const check  = luhnCheckDigit(padded);
  return padded + check;
}

/**
 * Validate that an OCR reference has a valid Luhn check digit.
 */
export function validateOCR(ocr: string): boolean {
  if (!/^\d+$/.test(ocr) || ocr.length < 2) return false;
  const digits = ocr.slice(0, -1);
  const check  = parseInt(ocr.slice(-1), 10);
  return luhnCheckDigit(digits) === check;
}

function luhnCheckDigit(digits: string): number {
  let sum = 0;
  let alt = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return (10 - (sum % 10)) % 10;
}

// ─── Bankgiro validation ──────────────────────────────────────────────────────

/**
 * Validate a Swedish Bankgiro number.
 * Accepts "XXX-XXXX" or "XXXXXXX" (7 digits).
 */
export function validateBankgiro(bg: string): boolean {
  const digits = bg.replace('-', '');
  return /^\d{7}$/.test(digits);
}

/**
 * Format a 7-digit Bankgiro number as "XXX-XXXX".
 */
export function formatBankgiro(bg: string): string {
  const digits = bg.replace('-', '');
  if (digits.length !== 7) return bg;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

// ─── IBAN validation ──────────────────────────────────────────────────────────

/**
 * Validate a Swedish IBAN (SE format, 24 chars).
 * Swedish IBAN: SE + 2 check digits + 20 digit BBAN
 * Example: SE4550000000058398257466
 */
export function validateSwedishIBAN(iban: string): boolean {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!clean.startsWith('SE') || clean.length !== 24) return false;
  if (!/^SE\d{22}$/.test(clean)) return false;
  // Validate check digits using ISO 7064 MOD-97-10
  return ibanMod97(clean) === 1;
}

function ibanMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric    = rearranged.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 ? String(code - 55) : c;  // A=10, B=11, ...
  }).join('');

  let remainder = 0;
  for (const char of numeric) {
    remainder = (remainder * 10 + parseInt(char, 10)) % 97;
  }
  return remainder;
}

/**
 * Format an IBAN with spaces for display (e.g. "SE45 5000 0000 0583 9825 7466").
 */
export function formatIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, '');
  return clean.match(/.{1,4}/g)?.join(' ') ?? iban;
}

// ─── Payment instructions ─────────────────────────────────────────────────────

export interface BankTransferInstructions {
  bankgiro:    string;
  iban:        string;
  ocr:         string;
  amount:      number;        // in SEK
  dueDate:     string;        // ISO date, e.g. "2024-07-01"
  paymentText: string;        // human-readable instructions for the customer
}

/**
 * Generate bank transfer payment instructions for an invoice.
 *
 * @param orderId    Your internal order/agreement ID (used to generate OCR)
 * @param amount     Amount in SEK (will be shown to customer)
 * @param daysUntilDue  Days until payment is due (default 30)
 */
export function generatePaymentInstructions(
  orderId:       number,
  amount:        number,
  daysUntilDue = 30,
): BankTransferInstructions {
  const ocr     = generateOCR(orderId);
  const dueDate = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const paymentText = [
    `Betalningsuppgifter / Payment instructions`,
    ``,
    `Bankgiro:    ${formatBankgiro(BANKGIRO)}`,
    `IBAN:        ${formatIBAN(IBAN)}`,
    `OCR/Ref:     ${ocr}`,
    `Belopp:      ${amount.toLocaleString('sv-SE')} SEK`,
    `Förfallodatum: ${dueDate}`,
    ``,
    `Ange alltid OCR-referensen vid betalning.`,
    `Always include the OCR reference with your payment.`,
  ].join('\n');

  return {
    bankgiro:    formatBankgiro(BANKGIRO),
    iban:        formatIBAN(IBAN),
    ocr,
    amount,
    dueDate,
    paymentText,
  };
}

/**
 * Check if a bank transfer has likely been received by matching the OCR.
 * In production, integrate with your bank's file API (BGC Autogiro / SEB API / etc.)
 * to automatically match incoming transfers by OCR reference.
 *
 * This placeholder returns false — implement with your bank's transaction feed.
 */
export async function checkPaymentReceived(
  ocr:    string,
  amount: number,
): Promise<{ received: boolean; transactionDate?: string }> {
  // TODO: Integrate with your bank's incoming payment file (BGC format) or API.
  // Swedish banks support automatic matching via:
  //   - Bankgirot BGC (file-based, daily)
  //   - Open Banking PSD2 APIs (real-time, e.g. Nordea, SEB, Handelsbanken)
  console.log(`[bank_transfer] Check for OCR ${ocr} amount ${amount} SEK — not yet integrated`);
  return { received: false };
}
