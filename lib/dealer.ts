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
