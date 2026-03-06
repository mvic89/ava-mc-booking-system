/**
 * Klarna Payments API client
 *
 * Docs: https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/
 * Auth: HTTP Basic Auth  →  username = merchant API username, password = API secret
 *
 * Two environments:
 *   Playground: https://api.playground.klarna.com   (use this with test credentials)
 *   Production:  https://api.klarna.com
 *
 * Required env vars:
 *   KLARNA_API_URL      – base URL (defaults to playground)
 *   KLARNA_API_USERNAME – your Klarna API username (looks like "PK12345_abcd1234efgh5678")
 *   KLARNA_API_PASSWORD – your Klarna API secret
 */

const API_URL  = process.env.KLARNA_API_URL      ?? 'https://api.playground.klarna.com';
const USERNAME = process.env.KLARNA_API_USERNAME  ?? '';
const PASSWORD = process.env.KLARNA_API_PASSWORD  ?? '';

function basicAuth(): string {
  return 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
}

async function klarnaFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': basicAuth(),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Klarna ${res.status} ${res.statusText}: ${body}`);
  }

  // 204 No Content — return empty object
  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KlarnaOrderLine {
  type:              'physical' | 'digital' | 'shipping_fee' | 'discount';
  name:              string;
  quantity:          number;
  unit_price:        number;   // in minor units (öre for SEK)
  total_amount:      number;   // in minor units
  tax_rate:          number;   // e.g. 2500 = 25.00%
  total_tax_amount:  number;   // in minor units
  reference?:        string;
}

export interface KlarnaSessionRequest {
  purchase_country:    string;   // 'SE'
  purchase_currency:   string;   // 'SEK'
  locale:              string;   // 'sv-SE'
  order_amount:        number;   // total in minor units
  order_tax_amount:    number;   // total tax in minor units
  order_lines:         KlarnaOrderLine[];
  merchant_reference1?: string;  // your agreement number
  intent?:             'buy' | 'tokenize' | 'buy_and_tokenize';
}

export interface KlarnaPaymentMethodCategory {
  identifier:  string;   // e.g. 'pay_later', 'pay_over_time', 'pay_now'
  name:        string;   // human-readable name
  asset_urls?: { descriptive?: string; standard?: string };
}

export interface KlarnaSessionResponse {
  session_id:                string;
  client_token:              string;
  payment_method_categories: KlarnaPaymentMethodCategory[];
}

export interface KlarnaOrderRequest extends KlarnaSessionRequest {
  // same shape as session request — Klarna re-validates the order on authorization
}

export interface KlarnaOrderResponse {
  order_id:      string;
  redirect_url?: string;
  fraud_status:  'ACCEPTED' | 'PENDING' | 'REJECTED';
}

export interface KlarnaCustomerTokenRequest {
  purchase_country:  string;   // 'SE'
  purchase_currency: string;   // 'SEK'
  locale:            string;   // 'sv-SE'
  description?:      string;
  intended_use?:     'SUBSCRIPTION' | 'RECURRING' | 'UNSCHEDULED';
  billing_address?: {
    given_name?:      string;
    family_name?:     string;
    email?:           string;
    street_address?:  string;
    postal_code?:     string;
    city?:            string;
    country?:         string;
  };
}

export interface KlarnaCustomerTokenResponse {
  token_id:             string;
  redirect_url?:        string;
  payment_method_type?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Step 1 — Create a Klarna payment session.
 * Returns client_token (passed to JS SDK) and payment_method_categories.
 * Sessions are valid for 48 hours.
 */
export async function createKlarnaSession(
  params: KlarnaSessionRequest,
): Promise<KlarnaSessionResponse> {
  return klarnaFetch<KlarnaSessionResponse>('/payments/v1/sessions', {
    method: 'POST',
    body:   JSON.stringify({ intent: 'buy', ...params }),
  });
}

/**
 * Step 1b — Read an existing Klarna session (e.g. to refresh client_token).
 * Sessions are valid for 48 hours.
 */
export async function getKlarnaSession(sessionId: string): Promise<KlarnaSessionResponse> {
  return klarnaFetch<KlarnaSessionResponse>(`/payments/v1/sessions/${sessionId}`);
}

/**
 * Step 1c — Update an existing Klarna session (e.g. to change order amount).
 * Returns 204 No Content on success.
 */
export async function updateKlarnaSession(
  sessionId: string,
  params: Partial<KlarnaSessionRequest>,
): Promise<void> {
  await klarnaFetch<void>(`/payments/v1/sessions/${sessionId}`, {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Step 2b — Cancel a Klarna authorization token (e.g. if the customer aborts).
 * Returns 204 No Content on success.
 */
export async function cancelKlarnaAuthorization(authorizationToken: string): Promise<void> {
  await klarnaFetch<void>(`/payments/v1/authorizations/${authorizationToken}`, {
    method: 'DELETE',
  });
}

/**
 * Step 3b — Generate a reusable customer token for subscriptions/recurring payments.
 * Must be called with a valid authorization_token from Klarna.Payments.authorize().
 */
export async function createKlarnaCustomerToken(
  authorizationToken: string,
  params: KlarnaCustomerTokenRequest,
): Promise<KlarnaCustomerTokenResponse> {
  return klarnaFetch<KlarnaCustomerTokenResponse>(
    `/payments/v1/authorizations/${authorizationToken}/customer-token`,
    {
      method: 'POST',
      body:   JSON.stringify(params),
    },
  );
}

/**
 * Step 3 — After Klarna.Payments.authorize() succeeds on the frontend,
 * call this to place the actual Klarna order.
 * Returns order_id and fraud_status.
 */
export async function createKlarnaOrder(
  authorizationToken: string,
  params: KlarnaOrderRequest,
): Promise<KlarnaOrderResponse> {
  return klarnaFetch<KlarnaOrderResponse>(
    `/payments/v1/authorizations/${authorizationToken}/order`,
    {
      method: 'POST',
      body:   JSON.stringify(params),
    },
  );
}
