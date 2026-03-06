import { createHash } from 'crypto';

/**
 * Svea Auth Helpers
 *
 * Two authentication methods from the Svea Postman collections:
 *
 * 1. HMAC-SHA512  — used by Checkout API + Admin/External API
 *    Authorization: "Svea {HMAC}"
 *    Timestamp:     "YYYY-M-D H:mm"  (UTC hours, local minutes)
 *
 * 2. Basic Auth   — used by Instore API
 *    Authorization: "Basic Base64(username:password)"
 */

// ─── HMAC-SHA512 (Checkout + Admin APIs) ─────────────────────────────────────

/**
 * Timestamp format Svea expects: "YYYY-M-D H:mm"
 * Hours = UTC hours, minutes = local minutes
 */
export function sveaTimestamp(): string {
  const now = new Date();
  const year    = now.getFullYear();
  const month   = now.getMonth() + 1;
  const day     = now.getDate();
  const hours   = now.getUTCHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Build the HMAC for Authorization: "Svea {hmac}"
 *
 * Formula (from Svea Postman pre-request scripts):
 *   signatureRawData = requestBody + secret + timestamp
 *   hash             = SHA512(signatureRawData)
 *   j                = merchantId + ":" + hash
 *   hmac             = Base64(j)
 *
 * For GET requests or empty body: requestBody = ""
 */
export function sveaHmac(
  merchantId: string,
  secret: string,
  timestamp: string,
  requestBody: string = '',
): string {
  const signatureRawData = requestBody + secret + timestamp;
  const hash = createHash('sha512').update(signatureRawData).digest('hex');
  const j = `${merchantId}:${hash}`;
  return Buffer.from(j, 'utf8').toString('base64');
}

/**
 * Returns the headers required for Checkout / Admin API calls.
 */
export function sveaHmacHeaders(
  requestBody: string = '',
  method: string = 'POST',
): Record<string, string> {
  const merchantId = process.env.SVEA_CHECKOUT_MERCHANT_ID!;
  const secret     = process.env.SVEA_CHECKOUT_SECRET!;
  const timestamp  = sveaTimestamp();
  const body       = method.toUpperCase() === 'GET' ? '' : requestBody;
  const hmac       = sveaHmac(merchantId, secret, timestamp, body);

  return {
    'Authorization':       `Svea ${hmac}`,
    'Timestamp':           timestamp,
    'Content-Type':        'application/json',
    'X-Svea-CorrelationId': crypto.randomUUID(),
  };
}

// ─── Basic Auth (Instore API) ─────────────────────────────────────────────────

/**
 * Returns the Authorization header for the Instore API.
 * Uses Basic Auth: Base64(username:password)
 */
export function sveaBasicAuthHeader(): Record<string, string> {
  const username = process.env.SVEA_INSTORE_USERNAME!;
  const password = process.env.SVEA_INSTORE_PASSWORD!;
  const encoded  = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return {
    'Authorization': `Basic ${encoded}`,
    'Content-Type':  'application/json',
  };
}
