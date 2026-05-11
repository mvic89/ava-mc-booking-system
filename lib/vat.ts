/**
 * Swedish VAT / Moms calculation
 *
 * Three schemes under Mervärdesskattelagen (ML):
 *
 *  normal  — Standard 25 % moms on full price (new vehicles, accessories, service)
 *  margin  — Marginalbeskattning 9a kap ML (used vehicles bought from private sellers)
 *             VAT = 20 % × (selling price − purchase price)
 *             VAT is NOT itemised on the customer invoice
 *  exempt  — Momsfri (financing, insurance, certain public-sector sales)
 */

export type VatScheme = 'normal' | 'margin' | 'exempt';

export interface VatResult {
  scheme:        VatScheme;
  totalAmount:   number;   // what the customer pays (inkl moms)
  netAmount:     number;   // ex moms (bookkeeping revenue)
  vatAmount:     number;   // moms to remit to Skatteverket
  marginAmount:  number;   // selling − purchase (margin scheme only, else 0)
  vatRate:       number;   // 0.25 | 0 | 0 (informational)
  /** True when the invoice must NOT show a VAT line (9a kap margin invoices) */
  vatHidden:     boolean;
}

/**
 * Calculate VAT for an invoice line.
 *
 * @param scheme         - Which VAT scheme applies
 * @param totalAmount    - Customer-facing total (inkl moms)
 * @param purchasePrice  - Required for margin scheme; what the dealer paid
 */
export function calcVat(
  scheme: VatScheme,
  totalAmount: number,
  purchasePrice = 0,
): VatResult {
  const total = Math.round(totalAmount * 100) / 100;

  if (scheme === 'normal') {
    // 25 % moms included in price: vat = total × 25/125 = total × 0.2
    const vatAmount  = Math.round((total - total / 1.25) * 100) / 100;
    const netAmount  = Math.round((total - vatAmount)    * 100) / 100;
    return { scheme, totalAmount: total, netAmount, vatAmount, marginAmount: 0, vatRate: 0.25, vatHidden: false };
  }

  if (scheme === 'margin') {
    // Margin = selling price (inkl) − purchase price
    // VAT on margin = margin × 25/125 = margin × 0.2
    const margin    = Math.max(total - purchasePrice, 0);   // no negative margin VAT
    const vatAmount = Math.round(margin * 0.2 * 100) / 100;
    const netAmount = Math.round((total - vatAmount) * 100) / 100;
    return { scheme, totalAmount: total, netAmount, vatAmount, marginAmount: Math.round(margin * 100) / 100, vatRate: 0.25, vatHidden: true };
  }

  // exempt
  return { scheme, totalAmount: total, netAmount: total, vatAmount: 0, marginAmount: 0, vatRate: 0, vatHidden: false };
}

/**
 * Derive the correct VAT scheme from a vehicle's condition and lead type.
 * Falls back to 'normal' if uncertain.
 */
export function deriveVatScheme(
  vehicleCondition: 'new' | 'used' | string | null | undefined,
  leadType: string | null | undefined,
): VatScheme {
  if (leadType === 'accessories') return 'normal';
  if (vehicleCondition === 'used') return 'margin';
  return 'normal';
}

/**
 * Format a SEK amount for display on Swedish invoices.
 */
export function formatSEK(amount: number): string {
  return amount.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

/**
 * Swedish VAT period labels for momsredovisning.
 * Returns an array of { label, start, end } for each period in the given year,
 * grouped by the dealer's reporting interval.
 */
export function vatPeriods(
  year: number,
  interval: 'monthly' | 'quarterly',
): Array<{ label: string; start: Date; end: Date }> {
  if (interval === 'quarterly') {
    return [
      { label: `Q1 ${year}`, start: new Date(year, 0, 1),  end: new Date(year, 2, 31)  },
      { label: `Q2 ${year}`, start: new Date(year, 3, 1),  end: new Date(year, 5, 30)  },
      { label: `Q3 ${year}`, start: new Date(year, 6, 1),  end: new Date(year, 8, 30)  },
      { label: `Q4 ${year}`, start: new Date(year, 9, 1),  end: new Date(year, 11, 31) },
    ];
  }
  const months = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  return months.map((m, i) => ({
    label: `${m} ${year}`,
    start: new Date(year, i, 1),
    end:   new Date(year, i + 1, 0),
  }));
}
