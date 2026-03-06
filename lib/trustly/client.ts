/**
 * Trustly EU — Payments API Client
 *
 * Product: Open banking payments — customer pays directly from bank (no card data)
 * Docs:    https://docs.trustly.com/
 * Auth:    JSON-RPC 1.1 + RSA-2048 digital signature (NOT OAuth2 / Bearer tokens)
 *
 * Environments:
 *   Test:       https://test.trustly.com/api/1
 *   Production: https://api.trustly.com/1
 *
 * Test back office: https://test.trustly.com/backoffice
 *   → Use this to inspect notifications and manage test orders.
 *
 * ⚠️  Every Trustly request must be RSA-signed with your PRIVATE KEY.
 *     Trustly verifies using your PUBLIC KEY (registered in their back office).
 *     Bearer tokens are NOT used.
 *
 * Required env vars:
 *   TRUSTLY_API_KEY      – Your Trustly processing account username (API key)
 *   TRUSTLY_MERCHANT_ID  – Your Trustly merchant ID
 *   TRUSTLY_PRIVATE_KEY  – RSA private key PEM string (for signing requests)
 *   TRUSTLY_API_URL      – Base URL (defaults to test environment)
 */

import crypto from 'crypto';

const BASE_URL    = process.env.TRUSTLY_API_URL    ?? 'https://test.trustly.com/api/1';
const API_USER    = process.env.TRUSTLY_API_KEY    ?? '';
const MERCHANT_ID = process.env.TRUSTLY_MERCHANT_ID ?? '';
const PRIVATE_KEY = process.env.TRUSTLY_PRIVATE_KEY ?? '';

// ─── RSA signing ──────────────────────────────────────────────────────────────

/**
 * Sign a Trustly JSON-RPC request.
 * Trustly concatenates: method + uuid + sorted serialized params, then signs with RSA-SHA1.
 */
function signRequest(method: string, uuid: string, data: Record<string, unknown>): string {
  if (!PRIVATE_KEY) throw new Error('TRUSTLY_PRIVATE_KEY is not set');
  // Trustly signature: method + UUID + serialized data (alphabetical key sort)
  const serialized = serializeData(data);
  const plaintext  = method + uuid + serialized;
  return crypto
    .createSign('SHA1')
    .update(plaintext)
    .sign(PRIVATE_KEY, 'base64');
}

function serializeData(obj: unknown): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) return obj.map(serializeData).join('');
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return sorted.map(k => k + serializeData((obj as Record<string, unknown>)[k])).join('');
}

function uuid(): string {
  return crypto.randomUUID();
}

// ─── JSON-RPC request builder ─────────────────────────────────────────────────

async function trustlyCall<T = unknown>(
  method: string,
  data:   Record<string, unknown>,
): Promise<T> {
  const id   = uuid();
  const sign = signRequest(method, id, data);

  const res = await fetch(BASE_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method,
      params: {
        Signature: sign,
        UUID:      id,
        Data:      { Username: API_USER, Password: '', ...data },
      },
      version: '1.1',
    }),
  });

  const json = await res.json() as {
    result?: { signature: string; uuid: string; data: T };
    error?:  { name: string; code: number; message: string };
  };

  if (json.error) {
    throw new Error(`Trustly error ${json.error.code}: ${json.error.message}`);
  }

  return json.result!.data;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrustlyDepositParams {
  NotificationURL:  string;     // your webhook URL
  EndUserID:        string;     // unique customer identifier in your system
  MessageID:        string;     // unique order/message reference
  Currency:         string;     // 'SEK'
  Amount:           string;     // e.g. "100.00"
  Locale:           string;     // 'sv_SE'
  Country:          string;     // 'SE'
  SuccessURL:       string;
  FailURL:          string;
  URLTarget?:       string;     // '_self' | '_blank'
  MerchantID?:      string;
  SuggestedMinAmount?: string;
  SuggestedMaxAmount?: string;
}

export interface TrustlyDepositResponse {
  orderid: string;
  url:     string;    // redirect customer here to complete bank authentication
}

export interface TrustlyRefundParams {
  OrderID:   string;   // Trustly order ID from the deposit
  Amount:    string;   // amount to refund e.g. "50.00"
  Currency:  string;
}

export interface TrustlyRefundResponse {
  orderid:   string;
  result:    '1' | '0';
}

export interface TrustlyGetWithdrawalsParams {
  FromDate: string;   // 'YYYY-MM-DD'
  ToDate:   string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Initiate a deposit (payment) — redirect customer to the returned URL to select
 * their bank and authenticate.
 */
export async function initiateDeposit(
  params: TrustlyDepositParams,
): Promise<TrustlyDepositResponse> {
  return trustlyCall<TrustlyDepositResponse>('Deposit', {
    MerchantID: MERCHANT_ID,
    ...params,
  });
}

/**
 * Initiate a refund for a completed deposit.
 */
export async function refundDeposit(
  params: TrustlyRefundParams,
): Promise<TrustlyRefundResponse> {
  return trustlyCall<TrustlyRefundResponse>('Refund', params);
}

/**
 * Get completed withdrawals (settlements) for a date range.
 * Useful for reconciliation.
 */
export async function getWithdrawals(
  params: TrustlyGetWithdrawalsParams,
): Promise<unknown[]> {
  return trustlyCall<unknown[]>('GetWithdrawals', { MerchantID: MERCHANT_ID, ...params });
}

/**
 * Get all settlements in a date range.
 */
export async function getSettlements(fromDate: string, toDate: string): Promise<unknown[]> {
  return trustlyCall<unknown[]>('GetSettlementDetails', {
    MerchantID: MERCHANT_ID,
    FromDate:   fromDate,
    ToDate:     toDate,
  });
}
