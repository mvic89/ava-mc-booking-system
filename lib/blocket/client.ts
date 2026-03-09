/**
 * lib/blocket/client.ts
 *
 * Blocket Professional (Blocket Proffs) API client.
 * Docs: https://www.blocket.se/annonser/proffs
 * API:  https://api.blocket.se/v2/ (dealer/professional ads API)
 *
 * Required env vars:
 *   BLOCKET_API_URL      Default: https://api.blocket.se/v2
 *   BLOCKET_API_KEY      API key from Blocket's professional seller portal
 *   BLOCKET_ACCOUNT_ID   Your Blocket professional account ID
 *
 * Auth: API key in X-Api-Key header.
 *
 * Notes:
 *   - Images are uploaded separately and referenced by URL in the ad.
 *   - Motorcycles use category_id for the "Motorcycles" category.
 *   - Ads expire after 60 days by default; can be renewed.
 *   - Body type mapping: 'Naked' | 'Sportbike' | 'Touring' | 'Enduro' | 'Scooter' etc.
 */

const BASE = process.env.BLOCKET_API_URL ?? 'https://api.blocket.se/v2';

// Blocket motorcycle category ID (professional ads)
const MC_CATEGORY_ID = 'mc';

function headers(apiKey: string) {
  return {
    'X-Api-Key':    apiKey,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlocketAdImage {
  url:  string;
  alt?: string;
}

export interface BlocketAdCreate {
  subject:     string;          // Ad title, e.g. "Kawasaki Ninja ZX-6R 2024"
  body:        string;          // Description text
  price:       number;          // SEK
  category_id: string;          // 'mc' for motorcycles
  location:    {
    zip:    string;
    city:   string;
    region: string;
  };
  parameters:  {
    make:       string;          // e.g. "Kawasaki"
    model:      string;          // e.g. "Ninja ZX-6R"
    model_year: number;
    mileage:    number;          // km
    vin?:       string;
    color?:     string;
    fuel_type?: string;
    body_type?: string;
  };
  images?:     BlocketAdImage[];
  contact?: {
    name?:  string;
    phone?: string;
    email?: string;
  };
}

export interface BlocketAd {
  id:          string;
  subject:     string;
  price:       number;
  status:      'active' | 'expired' | 'deleted' | 'pending';
  created_at:  string;
  expires_at:  string;
  view_count:  number;
  ad_url:      string;
  parameters:  Record<string, unknown>;
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function listActiveAds(
  apiKey:    string,
  accountId: string,
): Promise<BlocketAd[]> {
  const res = await fetch(
    `${BASE}/accounts/${encodeURIComponent(accountId)}/ads?status=active`,
    { headers: headers(apiKey) },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blocket listAds ${res.status}: ${err}`);
  }
  const data = await res.json() as { ads: BlocketAd[] };
  return data.ads ?? [];
}

// ─── Create ad ────────────────────────────────────────────────────────────────

export async function createAd(
  apiKey:    string,
  accountId: string,
  ad:        BlocketAdCreate,
): Promise<BlocketAd> {
  const payload = {
    ...ad,
    category_id: MC_CATEGORY_ID,
  };
  const res = await fetch(
    `${BASE}/accounts/${encodeURIComponent(accountId)}/ads`,
    {
      method:  'POST',
      headers: headers(apiKey),
      body:    JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blocket createAd ${res.status}: ${err}`);
  }
  const data = await res.json() as { ad: BlocketAd };
  return data.ad;
}

// ─── Delete ad ────────────────────────────────────────────────────────────────

export async function deleteAd(
  apiKey:    string,
  accountId: string,
  adId:      string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/accounts/${encodeURIComponent(accountId)}/ads/${encodeURIComponent(adId)}`,
    {
      method:  'DELETE',
      headers: headers(apiKey),
    },
  );
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Blocket deleteAd ${res.status}: ${err}`);
  }
}

// ─── Update ad ────────────────────────────────────────────────────────────────

export async function updateAd(
  apiKey:    string,
  accountId: string,
  adId:      string,
  patch:     Partial<BlocketAdCreate>,
): Promise<BlocketAd> {
  const res = await fetch(
    `${BASE}/accounts/${encodeURIComponent(accountId)}/ads/${encodeURIComponent(adId)}`,
    {
      method:  'PATCH',
      headers: headers(apiKey),
      body:    JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blocket updateAd ${res.status}: ${err}`);
  }
  const data = await res.json() as { ad: BlocketAd };
  return data.ad;
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testConnection(
  apiKey:    string,
  accountId: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${BASE}/accounts/${encodeURIComponent(accountId)}`,
      { headers: headers(apiKey) },
    );
    return res.status !== 401 && res.status !== 403;
  } catch {
    return false;
  }
}
