/**
 * Swish Merchant Payments — API Client
 *
 * Docs:    https://developer.swish.nu/
 * Auth:    Mutual TLS (mTLS) — client certificate + private key. NO API keys.
 *
 * Environments:
 *   Test (MSS simulator): https://mss.cpc.getswish.net/swish-cpcapi/api/v2/
 *   Production:           https://cpc.getswish.net/swish-cpcapi/api/v2/
 *
 * Test certificate:
 *   File:       FPTestcert4_20230629.p12  (download from developer.swish.nu)
 *   Passphrase: qwerty123
 *   ⚠️  Swish server changed its CA chain on 2025-03-20 — update your truststore to
 *       GeoTrust TLS RSA CA G1 / DigiCert Global Root G2 if needed.
 *
 * ⚠️  Node.js/Next.js API routes do NOT natively support mTLS via fetch().
 *     You must use the `https` module with an `Agent` that has the client certificate.
 *     See the example in swishFetch() below.
 *
 * Required env vars:
 *   SWISH_PAYEE_ALIAS      – Your Swish number (10 digits, e.g. "1231181189")
 *   SWISH_CERT_PATH        – Path to the .p12 certificate file
 *   SWISH_CERT_PASSPHRASE  – Passphrase for the .p12 file
 *   SWISH_API_URL          – Base URL (defaults to test MSS simulator)
 */

const BASE_URL       = process.env.SWISH_API_URL          ?? 'https://mss.cpc.getswish.net/swish-cpcapi/api/v2';
const PAYEE_ALIAS    = process.env.SWISH_PAYEE_ALIAS       ?? '';
const CERT_PATH      = process.env.SWISH_CERT_PATH         ?? '';
const CERT_PASSPHRASE = process.env.SWISH_CERT_PASSPHRASE  ?? '';

/**
 * Build an HTTPS agent with the mTLS certificate.
 * Must be called server-side only (uses Node.js built-ins).
 */
async function getAgent() {
  const [https, fs] = await Promise.all([
    import('https'),
    import('fs'),
  ]);

  const pfx = fs.readFileSync(CERT_PATH);
  return new https.Agent({ pfx, passphrase: CERT_PASSPHRASE, rejectUnauthorized: true });
}

/**
 * Make a request to the Swish API using mTLS.
 * Uses node-fetch or native fetch with agent (requires Node.js https module).
 */
async function swishFetch<T = unknown>(
  path:    string,
  options: RequestInit & { method?: string } = {},
): Promise<{ data: T; location?: string }> {
  const agent  = await getAgent();
  const url    = `${BASE_URL}${path}`;

  // @ts-expect-error — agent is Node.js specific, not in standard fetch types
  const res = await fetch(url, { ...options, agent });

  if (!res.ok && res.status !== 201) {
    const body = await res.text();
    throw new Error(`Swish ${res.status} ${res.statusText}: ${body}`);
  }

  // Swish returns 201 with a Location header for payment requests — no body
  const location = res.headers.get('location') ?? undefined;
  if (res.status === 201 || res.status === 204) return { data: {} as T, location };
  return { data: (await res.json()) as T, location };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwishPaymentStatus =
  | 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR' | 'CANCELLED';

export interface SwishPaymentRequest {
  callbackUrl:    string;           // your webhook — Swish POSTs status updates here
  payeeAlias:     string;           // your Swish number (SWISH_PAYEE_ALIAS)
  amount:         string;           // in SEK, e.g. "150.00"
  currency:       'SEK';
  payerAlias?:    string;           // customer's Swish number (for instore M-commerce)
  message?:       string;           // max 50 chars, shown in Swish app
  payeePaymentReference?: string;   // your internal reference (max 36 chars)
}

export interface SwishPaymentResponse {
  id:               string;
  paymentReference: string;
  status:           SwishPaymentStatus;
  amount:           number;
  currency:         string;
  payeeAlias:       string;
  payerAlias:       string;
  message?:         string;
  datePaid?:        string;
  errorCode?:       string;
  errorMessage?:    string;
}

export interface SwishRefundRequest {
  callbackUrl:            string;
  payerAlias:             string;    // your Swish number (the merchant)
  amount:                 string;    // in SEK
  currency:               'SEK';
  originalPaymentReference: string;  // the id from the original payment
  message?:               string;
  payerPaymentReference?: string;    // your internal refund reference
}

export interface SwishRefundResponse {
  id:               string;
  paymentReference: string;
  status:           'CREATED' | 'PAID' | 'ERROR' | 'CANCELLED';
  amount:           number;
  currency:         string;
  datePaid?:        string;
  errorCode?:       string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Create a payment request.
 *
 * For M-Commerce (QR / deep link): omit payerAlias — Swish returns a token for the QR code.
 * For E-Commerce instore:          include payerAlias — customer's phone number.
 *
 * Returns the payment request ID extracted from the Location response header.
 */
export async function createPaymentRequest(
  params: SwishPaymentRequest,
): Promise<string> {
  const { location } = await swishFetch<void>('/paymentrequests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...params, payeeAlias: PAYEE_ALIAS }),
  });

  if (!location) throw new Error('Swish did not return a Location header for payment request');
  // Location header: /swish-cpcapi/api/v2/paymentrequests/{id}
  return location.split('/').pop()!;
}

/**
 * Get the current status of a payment request.
 * Poll this until status is 'PAID', 'DECLINED', or 'ERROR'.
 */
export async function getPaymentRequest(id: string): Promise<SwishPaymentResponse> {
  const { data } = await swishFetch<SwishPaymentResponse>(`/paymentrequests/${id}`);
  return data;
}

/**
 * Cancel a payment request (only possible while status is 'CREATED').
 */
export async function cancelPaymentRequest(id: string): Promise<void> {
  await swishFetch(`/paymentrequests/${id}`, { method: 'DELETE' });
}

/**
 * Create a refund for a completed payment.
 * Returns the refund ID.
 */
export async function createRefund(params: SwishRefundRequest): Promise<string> {
  const { location } = await swishFetch<void>('/refunds', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...params, payerAlias: PAYEE_ALIAS }),
  });

  if (!location) throw new Error('Swish did not return a Location header for refund');
  return location.split('/').pop()!;
}

/**
 * Get the status of a refund.
 */
export async function getRefund(id: string): Promise<SwishRefundResponse> {
  const { data } = await swishFetch<SwishRefundResponse>(`/refunds/${id}`);
  return data;
}
