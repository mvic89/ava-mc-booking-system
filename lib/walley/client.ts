/**
 * Walley (f.d. Collector Bank) — Checkout API Client
 *
 * Docs:    https://dev.walleypay.com/docs/checkout/
 * Auth:    OAuth2 client_credentials → Bearer token
 *
 * Environments:
 *   UAT (test):  https://api.uat.walleydev.com
 *   Production:  https://api.walleypay.com
 *
 * Merchant Hub:
 *   UAT:  https://merchanthub.aks.uat.walleydev.com
 *   Prod: https://merchanthub.walleypay.com
 *
 * OAuth2 scopes:
 *   UAT:  705798e0-8cef-427c-ae00-6023deba29af/.default
 *   Prod: a3f3019f-2be9-41cc-a254-7bb347238e89/.default
 *
 * Required env vars:
 *   WALLEY_STORE_ID   – OAuth2 client_id (generated in Merchant Hub)
 *   WALLEY_SHARED_KEY – OAuth2 client_secret (shown once — save immediately)
 *   WALLEY_API_URL    – Base URL (defaults to UAT/test environment)
 */

const IS_TEST  = !process.env.WALLEY_API_URL || process.env.WALLEY_API_URL.includes('uat');
const BASE_URL = process.env.WALLEY_API_URL ?? 'https://api.uat.walleydev.com';
const CLIENT_ID     = process.env.WALLEY_STORE_ID   ?? '';
const CLIENT_SECRET = process.env.WALLEY_SHARED_KEY ?? '';

const UAT_SCOPE  = '705798e0-8cef-427c-ae00-6023deba29af/.default';
const PROD_SCOPE = 'a3f3019f-2be9-41cc-a254-7bb347238e89/.default';

// ─── OAuth2 token management ──────────────────────────────────────────────────

let _token: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await fetch(`${BASE_URL}/oauth2/v2.0/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         IS_TEST ? UAT_SCOPE : PROD_SCOPE,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Walley OAuth2 token error ${res.status}: ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

async function walleyFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Walley ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalleyOrderItem {
  id:          string;
  description: string;
  quantity:    number;
  unitPrice:   number;   // in minor units (öre for SEK)
  vat:         number;   // e.g. 2500 = 25%
  discount?:   number;
  requiresElectronicId?: boolean;
}

export interface WalleyCustomer {
  nationalIdentificationNumber?: string;   // personnummer
  email?:  string;
  phone?:  string;
  billingAddress?: {
    company?: string;
    firstName?: string;
    lastName?:  string;
    address:    string;
    address2?:  string;
    postalCode: string;
    city:       string;
    country:    string;   // 'SE'
  };
}

export interface WalleyCreateCheckoutRequest {
  storeId:        string;
  countryCode:    string;        // 'SE'
  currency:       string;        // 'SEK'
  reference:      string;        // your order reference
  items:          WalleyOrderItem[];
  fees?:          WalleyOrderItem[];
  redirectPageUri: string;        // customer redirect URL after payment
  merchantTermsUri: string;
  notificationUri: string;        // webhook URL for status updates
  customer?:      WalleyCustomer;
  metadata?: Record<string, string>;
}

export interface WalleyCheckoutResponse {
  publicToken:    string;   // pass to the Walley JS SDK to render checkout
  expiresAt:      string;
  status:         'Created' | 'PurchaseCompleted' | 'PurchasePending' | 'SessionExpired';
  orderId?:       string;   // available after purchase complete
}

export interface WalleyOrder {
  orderId:     string;
  reference:   string;
  status:      'PurchaseCompleted' | 'Activated' | 'Credited' | 'Cancelled';
  totalAmount: number;
  currency:    string;
  items:       WalleyOrderItem[];
  customer:    WalleyCustomer;
  createdAt:   string;
}

export interface WalleyCreditRequest {
  items: Array<{ id: string; quantity: number; unitPrice?: number }>;
  fees?: Array<{ id: string; quantity: number }>;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Create a Walley checkout session.
 * Pass the returned publicToken to the Walley Checkout JS SDK to render the
 * payment widget in your page:
 *   <script src="https://api.uat.walleydev.com/walley-checkout-loader.js"
 *           data-token="{publicToken}" />
 */
export async function createCheckout(
  params: WalleyCreateCheckoutRequest,
): Promise<WalleyCheckoutResponse> {
  return walleyFetch<WalleyCheckoutResponse>('/checkouts', {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Get checkout session status. Poll this after the customer completes payment.
 */
export async function getCheckout(publicToken: string): Promise<WalleyCheckoutResponse> {
  return walleyFetch<WalleyCheckoutResponse>(`/checkouts/${publicToken}`);
}

/**
 * Update the cart in an existing checkout session (e.g. if customer changes items).
 */
export async function updateCheckout(
  publicToken: string,
  items:       WalleyOrderItem[],
  fees?:       WalleyOrderItem[],
): Promise<WalleyCheckoutResponse> {
  return walleyFetch<WalleyCheckoutResponse>(`/checkouts/${publicToken}`, {
    method: 'PUT',
    body:   JSON.stringify({ items, fees }),
  });
}

/**
 * Get a completed order by order ID.
 */
export async function getOrder(orderId: string): Promise<WalleyOrder> {
  return walleyFetch<WalleyOrder>(`/orders/${orderId}`);
}

/**
 * Activate (capture) an order — releases funds from the customer's account.
 */
export async function activateOrder(orderId: string): Promise<void> {
  await walleyFetch(`/orders/${orderId}/activate`, { method: 'POST' });
}

/**
 * Cancel an order before activation.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  await walleyFetch(`/orders/${orderId}/cancel`, { method: 'POST' });
}

/**
 * Credit (refund) an activated order, partially or fully.
 */
export async function creditOrder(orderId: string, params: WalleyCreditRequest): Promise<void> {
  await walleyFetch(`/orders/${orderId}/credit`, {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}
