// ── Tenant context ─────────────────────────────────────────────────────────────
// Every dealership that registers gets a unique UUID written to
// localStorage['user'].dealershipId at signup time (and retrieved from
// Supabase on every subsequent login).
//
// All Supabase queries must call .eq('dealership_id', getDealershipId()) so
// that dealers can never read or write each other's data.

// ── Tag cache (set once from Supabase, used everywhere) ─────────────────────
// getDealershipTag() reads from this cache first so that all ID generators
// always derive the tag from the authoritative dealerships.name in Supabase,
// never from whatever was cached in localStorage.
let _tagCache: string | null = null

export function setDealershipTagCache(tag: string): void {
  _tagCache = tag
}

export function getDealershipId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    return (user.dealershipId as string) || null;
  } catch {
    return null;
  }
}

export function getDealershipName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    return (user.dealershipName as string) || null;
  } catch {
    return null;
  }
}

export interface DealershipProfile {
  name:    string;
  email:   string;
  phone:   string;
  address: string; // streetAddress + postalCode + city
}

/**
 * Returns the logged-in dealership's profile for use in PDFs and emails.
 * Falls back to empty strings so callers never get null/undefined.
 */
export function getDealershipProfile(): DealershipProfile {
  if (typeof window === 'undefined') {
    return { name: '', email: '', phone: '', address: '' };
  }
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    const street = (user.streetAddress as string) ?? '';
    const postal = (user.postalCode   as string) ?? '';
    const city   = (user.city         as string) ?? '';
    const parts  = [street, [postal, city].filter(Boolean).join(' ')].filter(Boolean);
    return {
      name:    (user.dealershipName as string) || '',
      email:   (user.email          as string) || '',
      phone:   (user.phone          as string) || '',
      address: parts.join(', '),
    };
  } catch {
    return { name: '', email: '', phone: '', address: '' };
  }
}

/**
 * Derives a short 3-letter tag from a dealership name string.
 * Examples:
 *   "AVA MC"            → "AVA"
 *   "Rotebro Din MC AB" → "ROT"
 *   "Göteborg Bikes"    → "GOT"
 *   "malmo mc"          → "MAL"
 */
export function tagFromName(name: string): string {
  const STOP = new Set(['AB', 'MC', 'AS', 'INC', 'LTD', 'GMBH', 'SRL', 'BV', 'SA', 'DIN', 'OG']);
  const words = name
    .toUpperCase()
    .replace(/[^A-ZÅÄÖÆØ0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP.has(w));
  const tag = words.length > 0
    ? words[0].substring(0, 3).replace(/[ÅÄÆ]/g, 'A').replace(/[ÖØ]/g, 'O')
    : 'XXX';
  return tag.padEnd(3, 'X').substring(0, 3);
}

/**
 * Returns the tag for the currently logged-in dealership.
 * Prefers the cache set by setDealershipTagCache() (populated from Supabase
 * at startup by InventoryContext). Falls back to localStorage so the app
 * still works if the context hasn't loaded yet.
 */
export function getDealershipTag(): string {
  if (_tagCache) return _tagCache;
  const name = getDealershipName();
  if (!name) return 'XXX';
  return tagFromName(name);
}
