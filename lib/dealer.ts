/**
 * getDealerInfo()
 *
 * Single source of truth for the subscribed dealer's identity data.
 * Priority: user object (always fresh from signup) → dealership_profile (editable in Settings).
 *
 * Call from any 'use client' component inside a useEffect or event handler
 * (localStorage is only available in the browser).
 */

export interface DealerInfo {
  name: string;
  orgNr: string;
  city: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  postalCode: string;
  // Payment / bank account details (configured in Settings → Profil)
  bankgiro:    string;   // e.g. "1234-5678"  (dealership_settings.bankgiro)
  swish:       string;   // Swish Handel number e.g. "1231234567" (dealership_settings.swish)
  iban:        string;   // e.g. "SE35 5000 0000 0549 1000 0003" (dealership_settings.iban)
  bic:         string;   // e.g. "HANDSESS" (dealership_settings.bic)
}

const EMPTY: DealerInfo = {
  name: '',
  orgNr: '',
  city: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  postalCode: '',
  bankgiro: '',
  swish:    '',
  iban:     '',
  bic:      '',
};

export function getDealerInfo(): DealerInfo {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    const p = JSON.parse(localStorage.getItem('dealership_profile') ?? '{}');
    return {
      // user.dealershipName is always canonical — set at signup and synced by Settings > Profile
      name:       u.dealershipName   || u.dealership || p.name       || '',
      orgNr:      p.orgNr            || u.orgNr                      || '',
      city:       p.city             || u.city                       || '',
      email:      p.email            || u.email                      || '',
      phone:      p.phone            || u.phone                      || '',
      website:    p.website          || u.website                    || '',
      address:    p.address          || u.streetAddress || u.address  || '',
      postalCode: p.postalCode       || u.postalCode                 || '',
      // Payment fields — keys match dealership_settings columns exactly
      bankgiro:   p.bankgiro         || u.bankgiro                   || '',
      swish:      p.swish            || u.swish                      || '',
      iban:       p.iban             || u.iban                       || '',
      bic:        p.bic              || u.bic                        || '',
    };
  } catch {
    return EMPTY;
  }
}

/** Derived: Swedish VAT number from org nr "556123-4567" → "SE556123456701" */
export function getVatNumber(orgNr: string): string {
  if (!orgNr) return '';
  return 'SE' + orgNr.replace('-', '') + '01';
}
