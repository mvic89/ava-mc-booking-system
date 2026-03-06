/**
 * Resurs Bank — Merchant API 2.0 Client
 *
 * Docs:    https://merchant-api.integration.resurs.com/
 * Auth:    OAuth2 client_credentials → Bearer token
 *
 * Environments:
 *   Integration (test): https://merchant-api.integration.resurs.com
 *   Production:         https://merchant-api.resurs.com  (provided at onboarding)
 *
 * Required env vars:
 *   RESURS_CLIENT_ID     – OAuth2 client ID (from Resurs onboarding)
 *   RESURS_CLIENT_SECRET – OAuth2 client secret
 *   RESURS_API_URL       – Base URL (defaults to integration/test environment)
 *
 * Contact onboarding@resurs.se to request test credentials.
 */

const BASE_URL     = process.env.RESURS_API_URL       ?? 'https://merchant-api.integration.resurs.com';
const CLIENT_ID    = process.env.RESURS_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.RESURS_CLIENT_SECRET ?? '';

// ─── OAuth2 token management ──────────────────────────────────────────────────

let _token: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const encoded = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE_URL}/oauth2/token`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=merchant-api',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resurs OAuth2 token error ${res.status}: ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;  // refresh 60s early
  return _token;
}

async function resursF<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw new Error(`Resurs ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResursAddress {
  fullName:    string;
  addressRow1: string;
  addressRow2?: string;
  postalCode:  string;
  city:        string;
  countryCode: string;   // 'SE'
}

export interface ResursCustomer {
  customerType:     'NATURAL' | 'LEGAL';
  governmentId:     string;   // personnummer e.g. "8305147715"
  phone?:           string;
  email?:           string;
  deliveryAddress?: ResursAddress;
}

export interface ResursOrderLine {
  artNo:       string;
  description: string;
  quantity:    number;
  unitAmountWithoutVat: number;  // in minor units (öre)
  vatPct:      number;           // e.g. 25.00
  type:        'ORDER_LINE' | 'DISCOUNT' | 'SHIPPING_FEE';
}

export interface ResursCreatePaymentRequest {
  storeId:          string;
  paymentMethodId:  string;    // e.g. "RESURS_PART_PAYMENT"
  orderReference:   string;
  customer:         ResursCustomer;
  orderLines:       ResursOrderLine[];
  signing?: {
    successUrl:   string;
    failUrl:      string;
    backUrl?:     string;
  };
}

export interface ResursPaymentResponse {
  paymentId:   string;
  status:      'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FINALIZED' | 'CREDITED' | 'ANNULLED';
  orderLines:  ResursOrderLine[];
  customer:    ResursCustomer;
  signingUrl?: string;         // redirect customer here for signing
  createdAt:   string;
}

export interface ResursCreditRequest {
  orderLines: ResursOrderLine[];
}

export interface ResursStore {
  storeId:      string;
  storeName:    string;
  countryCode:  string;
  currency:     string;
}

export interface ResursPaymentMethod {
  id:          string;
  description: string;
  type:        string;
  minLimit:    number;
  maxLimit:    number;
  currency:    string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * List all stores for this merchant account.
 * Use the storeId from here when creating payments.
 */
export async function getStores(): Promise<ResursStore[]> {
  return resursF<ResursStore[]>('/v2/stores');
}

/**
 * List available payment methods for a store and customer.
 * Use the returned method IDs when creating a payment.
 */
export async function getPaymentMethods(
  storeId: string,
  opts?: { customerType?: 'NATURAL' | 'LEGAL'; amount?: number },
): Promise<ResursPaymentMethod[]> {
  const params = new URLSearchParams({ storeId });
  if (opts?.customerType) params.set('customerType', opts.customerType);
  if (opts?.amount)       params.set('amount', String(opts.amount));
  return resursF<ResursPaymentMethod[]>(`/v2/payment-methods?${params}`);
}

/**
 * Create a new payment (financing or invoice).
 * On success, redirect the customer to signingUrl for BankID signing.
 */
export async function createPayment(
  params: ResursCreatePaymentRequest,
): Promise<ResursPaymentResponse> {
  return resursF<ResursPaymentResponse>('/v2/payments', {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Get payment details and current status.
 */
export async function getPayment(paymentId: string): Promise<ResursPaymentResponse> {
  return resursF<ResursPaymentResponse>(`/v2/payments/${paymentId}`);
}

/**
 * Cancel/annul a payment (before finalization/delivery).
 */
export async function cancelPayment(paymentId: string): Promise<void> {
  await resursF(`/v2/payments/${paymentId}/annul`, { method: 'POST' });
}

/**
 * Finalize/capture a payment (trigger delivery/payout).
 */
export async function finalizePayment(
  paymentId: string,
  orderLines: ResursOrderLine[],
): Promise<void> {
  await resursF(`/v2/payments/${paymentId}/finalize`, {
    method: 'POST',
    body:   JSON.stringify({ orderLines }),
  });
}

/**
 * Credit (refund) a finalized payment, partially or fully.
 */
export async function creditPayment(
  paymentId: string,
  params: ResursCreditRequest,
): Promise<void> {
  await resursF(`/v2/payments/${paymentId}/credit`, {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}
