/**
 * lib/inventory-sync.ts
 *
 * Helpers that push inventory changes to:
 *   1. Blocket (Swedish vehicle classifieds — dealer REST API)
 *   2. The dealership's own website (generic webhook)
 *
 * Both channels are optional and fail gracefully — if credentials are
 * missing the functions return { ok: false, skipped: true } without throwing.
 *
 * Call syncPublish()  when an item is added to stock.
 * Call syncUnpublish() when an item is sold / removed.
 * Call syncUpdate()   when price, description or images change.
 */

export interface SyncItem {
  id:           string;
  dealershipId: string;
  itemType:     'motorcycle' | 'spare_part' | 'accessory';
  title:        string;     // e.g. "Honda CB500F 2023"
  description?: string;
  price:        number;     // selling price in SEK
  condition?:   string;     // new | used
  year?:        number;
  mileage?:     number;
  color?:       string;
  vin?:         string;
  regNumber?:   string;
  imageUrls?:   string[];
  category?:    string;     // Blocket category name
  stock?:       number;
}

export interface SyncResult {
  ok:         boolean;
  skipped?:   boolean;     // true when credentials not configured
  provider?:  string;
  externalId?: string;
  error?:     string;
}

// ─── Blocket ─────────────────────────────────────────────────────────────────

const BLOCKET_API_URL    = process.env.BLOCKET_API_URL    ?? 'https://api.blocket.se/v2';
const BLOCKET_API_KEY    = process.env.BLOCKET_API_KEY    ?? '';
const BLOCKET_ACCOUNT_ID = process.env.BLOCKET_ACCOUNT_ID ?? '';

function blocketAuthHeaders() {
  return {
    'Authorization': `Bearer ${BLOCKET_API_KEY}`,
    'Content-Type':  'application/json',
    'X-Account-Id':  BLOCKET_ACCOUNT_ID,
  };
}

function toBlocketPayload(item: SyncItem) {
  return {
    title:       item.title,
    description: item.description ?? item.title,
    price:       item.price,
    currency:    'SEK',
    category:    item.itemType === 'motorcycle' ? 'mc_moped' : 'mc_tillbehor',
    condition:   item.condition === 'new' ? 'new' : 'used',
    year:        item.year,
    mileage:     item.mileage ?? 0,
    color:       item.color,
    vin:         item.vin,
    registration_number: item.regNumber,
    images:      (item.imageUrls ?? []).map(url => ({ url })),
    dealer_reference: item.id,
  };
}

export async function blocketPublish(item: SyncItem): Promise<SyncResult> {
  if (!BLOCKET_API_KEY || !BLOCKET_ACCOUNT_ID) {
    return { ok: false, skipped: true, provider: 'blocket' };
  }
  try {
    const res  = await fetch(`${BLOCKET_API_URL}/ads`, {
      method:  'POST',
      headers: blocketAuthHeaders(),
      body:    JSON.stringify(toBlocketPayload(item)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, provider: 'blocket', error: data.message ?? `HTTP ${res.status}` };
    return { ok: true, provider: 'blocket', externalId: data.id ?? data.ad_id };
  } catch (err: unknown) {
    return { ok: false, provider: 'blocket', error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function blocketUnpublish(blocketAdId: string): Promise<SyncResult> {
  if (!BLOCKET_API_KEY || !BLOCKET_ACCOUNT_ID) {
    return { ok: false, skipped: true, provider: 'blocket' };
  }
  try {
    const res = await fetch(`${BLOCKET_API_URL}/ads/${blocketAdId}`, {
      method:  'DELETE',
      headers: blocketAuthHeaders(),
    });
    if (!res.ok && res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, provider: 'blocket', error: data.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, provider: 'blocket' };
  } catch (err: unknown) {
    return { ok: false, provider: 'blocket', error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function blocketUpdatePrice(blocketAdId: string, price: number): Promise<SyncResult> {
  if (!BLOCKET_API_KEY || !BLOCKET_ACCOUNT_ID) {
    return { ok: false, skipped: true, provider: 'blocket' };
  }
  try {
    const res = await fetch(`${BLOCKET_API_URL}/ads/${blocketAdId}`, {
      method:  'PATCH',
      headers: blocketAuthHeaders(),
      body:    JSON.stringify({ price }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, provider: 'blocket', error: data.message ?? `HTTP ${res.status}` };
    return { ok: true, provider: 'blocket' };
  } catch (err: unknown) {
    return { ok: false, provider: 'blocket', error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Dealer website webhook ───────────────────────────────────────────────────

export async function websiteSync(
  webhookUrl: string,
  apiKey:     string,
  event:      'published' | 'updated' | 'sold',
  item:       SyncItem,
  blocketAdId?: string,
): Promise<SyncResult> {
  if (!webhookUrl) return { ok: false, skipped: true, provider: 'website' };
  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        event,
        item: {
          id:          item.id,
          dealershipId: item.dealershipId,
          type:        item.itemType,
          title:       item.title,
          description: item.description,
          price:       item.price,
          condition:   item.condition,
          year:        item.year,
          mileage:     item.mileage,
          color:       item.color,
          vin:         item.vin,
          regNumber:   item.regNumber,
          imageUrls:   item.imageUrls ?? [],
          category:    item.category,
          blocketAdId,
        },
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) return { ok: false, provider: 'website', error: `HTTP ${res.status}` };
    return { ok: true, provider: 'website' };
  } catch (err: unknown) {
    return { ok: false, provider: 'website', error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Combined publish / unpublish ─────────────────────────────────────────────

export async function syncPublish(
  item: SyncItem,
  webhookUrl?: string,
  webhookApiKey?: string,
): Promise<{ blocket: SyncResult; website: SyncResult }> {
  const [blocket, website] = await Promise.all([
    blocketPublish(item),
    websiteSync(webhookUrl ?? '', webhookApiKey ?? '', 'published', item),
  ]);
  return { blocket, website };
}

export async function syncUnpublish(
  item:           SyncItem,
  blocketAdId?:   string,
  webhookUrl?:    string,
  webhookApiKey?: string,
): Promise<{ blocket: SyncResult; website: SyncResult }> {
  const [blocket, website] = await Promise.all([
    blocketAdId ? blocketUnpublish(blocketAdId) : Promise.resolve<SyncResult>({ ok: false, skipped: true }),
    websiteSync(webhookUrl ?? '', webhookApiKey ?? '', 'sold', item, blocketAdId),
  ]);
  return { blocket, website };
}
