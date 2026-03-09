/**
 * Bambora (Worldline) Europe — API Client
 *
 * Product: Online card payments + physical terminal (Bambora Terminal)
 * Docs:    https://developer.bambora.com/europe
 * Auth:    Token-based — exchange merchant credentials for a session token via login endpoint
 *
 * Environments:
 *   Login:       https://login-v1.api-eu.bambora.com
 *   Checkout:    https://api.v1.checkout.bambora.com
 *   Transaction: https://transaction-v1.api-eu.bambora.com
 *   Merchant:    https://merchant-v1.api-eu.bambora.com
 *
 * ⚠️  No separate test subdomain — use the same production endpoints with test credentials.
 *     Register a free test account at developer.bambora.com.
 *
 * Required env vars:
 *   BAMBORA_API_KEY     – Merchant API key (from Bambora back office)
 *   BAMBORA_MERCHANT_ID – Your merchant number
 */

const LOGIN_URL       = 'https://login-v1.api-eu.bambora.com';
const CHECKOUT_URL    = 'https://api.v1.checkout.bambora.com';
const TRANSACTION_URL = 'https://transaction-v1.api-eu.bambora.com';
const MERCHANT_URL    = 'https://merchant-v1.api-eu.bambora.com';

const API_KEY     = process.env.BAMBORA_API_KEY     ?? '';
const MERCHANT_ID = process.env.BAMBORA_MERCHANT_ID ?? '';

// ─── Session token management ─────────────────────────────────────────────────

let _sessionToken: string | null = null;
let _sessionExpiry = 0;

/**
 * Obtain a session token by logging in with merchant credentials.
 * Tokens are short-lived — this function caches and auto-refreshes.
 */
async function getSessionToken(): Promise<string> {
  if (_sessionToken && Date.now() < _sessionExpiry) return _sessionToken;

  const res = await fetch(LOGIN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ token: `${MERCHANT_ID}@${API_KEY}` }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bambora login ${res.status}: ${body}`);
  }

  const data = await res.json() as { token: string; expires_in?: number };
  _sessionToken = data.token;
  _sessionExpiry = Date.now() + ((data.expires_in ?? 1800) - 60) * 1000;
  return _sessionToken;
}

async function bamboraFetch<T = unknown>(
  baseUrl: string,
  path:    string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getSessionToken();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bambora ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BamboraOrderLine {
  id:          string;
  description: string;
  quantity:    number;
  unit:        string;
  unitPrice:   number;    // in minor units (öre for SEK)
  vat:         number;    // e.g. 25.00
  vatAmount:   number;    // in minor units
  grossAmount: number;    // in minor units (quantity × unitPrice + vat)
  netAmount:   number;    // in minor units (quantity × unitPrice)
}

export interface BamboraCheckoutRequest {
  order: {
    id:          string;    // your unique order reference
    amount:      number;    // in minor units
    currency:    string;    // 'SEK'
    lines?:      BamboraOrderLine[];
  };
  urls: {
    accept:   string;    // success redirect URL
    cancel:   string;    // cancel redirect URL
    callback: string;    // webhook URL
  };
  paymentWindow?: {
    id:           number;  // payment window configuration ID from Bambora back office
    language?:    string;  // 'SWE'
  };
  customer?: {
    email?:  string;
    phone?:  string;
  };
}

export interface BamboraCheckoutResponse {
  token:      string;     // session token for the checkout page
  url:        string;     // redirect customer here to complete payment
}

export interface BamboraTransaction {
  id:          string;
  orderId:     string;
  amount:      number;
  currency:    string;
  status:      'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'CANCELLED' | 'FAILED';
  paymentType: string;
  createdAt:   string;
  card?: {
    maskedCardNumber: string;
    expiryMonth:      number;
    expiryYear:       number;
    cardType:         string;
  };
}

export interface BamboraCaptureRequest {
  amount:  number;
  lines?:  BamboraOrderLine[];
}

export interface BamboraRefundRequest {
  amount:    number;
  vatAmount: number;
  lines?:    BamboraOrderLine[];
}

// ─── API calls — Checkout (online) ───────────────────────────────────────────

/**
 * Create a checkout session.
 * Redirect the customer to the returned url to complete payment.
 */
export async function createCheckout(
  params: BamboraCheckoutRequest,
): Promise<BamboraCheckoutResponse> {
  return bamboraFetch<BamboraCheckoutResponse>(CHECKOUT_URL, '/sessions', {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Get checkout session details.
 */
export async function getCheckoutSession(token: string): Promise<BamboraCheckoutResponse> {
  return bamboraFetch<BamboraCheckoutResponse>(CHECKOUT_URL, `/sessions/${token}`);
}

// ─── API calls — Transaction management ──────────────────────────────────────

/**
 * Get a transaction by ID.
 */
export async function getTransaction(transactionId: string): Promise<BamboraTransaction> {
  return bamboraFetch<BamboraTransaction>(
    TRANSACTION_URL,
    `/transactions/${transactionId}`,
  );
}

/**
 * Capture (finalize) an authorized transaction.
 */
export async function captureTransaction(
  transactionId: string,
  params:        BamboraCaptureRequest,
): Promise<{ meta: { result: boolean } }> {
  return bamboraFetch(TRANSACTION_URL, `/transactions/${transactionId}/capture`, {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Refund a captured transaction (partial or full).
 */
export async function refundTransaction(
  transactionId: string,
  params:        BamboraRefundRequest,
): Promise<{ meta: { result: boolean } }> {
  return bamboraFetch(TRANSACTION_URL, `/transactions/${transactionId}/credit`, {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Cancel / void an authorized transaction (before capture).
 */
export async function cancelTransaction(
  transactionId: string,
): Promise<{ meta: { result: boolean } }> {
  return bamboraFetch(TRANSACTION_URL, `/transactions/${transactionId}/delete`, {
    method: 'POST',
    body:   JSON.stringify({}),
  });
}

/**
 * Get merchant account details.
 */
export async function getMerchant(): Promise<Record<string, unknown>> {
  return bamboraFetch(MERCHANT_URL, `/merchants/${MERCHANT_ID}`);
}
