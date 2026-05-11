/**
 * Swedish personnummer utilities.
 *
 * maskPnr — hides the last 4 digits (birth sequence + check digit) for privacy.
 *   "19940821-2398" → "19940821-****"
 *   "199408212398"  → "19940821-****"
 *   "9408212398"    → "940821-****"
 *
 * normalizePnr — strips non-digits and reduces to 10-digit YYMMDDXXXX
 *   for safe equality comparison across formats.
 */

export function maskPnr(pnr: string | null | undefined): string {
  if (!pnr) return '—';
  const digits = pnr.replace(/\D/g, '');
  if (digits.length === 12) return `${digits.slice(0, 8)}-****`;
  if (digits.length === 10) return `${digits.slice(0, 6)}-****`;
  // Fallback: mask last 4 characters
  return pnr.length > 4 ? `${pnr.slice(0, -4)}****` : pnr;
}

export function normalizePnr(pnr: string): string {
  const digits = pnr.replace(/\D/g, '');
  return digits.length === 12 ? digits.slice(2) : digits;
}
