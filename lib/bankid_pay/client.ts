/**
 * BankID Pay — Client
 *
 * Product: Combined BankID authentication + payment in one step via Bankgirot clearing
 * Docs:    https://developers.bankid.com/
 * Auth:    Mutual TLS (mTLS) with a BankID Relying Party (RP) certificate
 *
 * ⚠️  BankID uses mTLS exclusively — there is no OAuth2 or API key flow.
 *     You need an RP certificate issued by a Swedish bank (e.g. Handelsbanken, SEB, Swedbank).
 *     Contact your bank's BankID integration team to obtain an RP certificate.
 *
 * ⚠️  API v5.0 and v5.1 were discontinued in September 2024.
 *     Only v6.0 is supported. personalNumber is no longer accepted in auth/sign requests.
 *
 * Environments:
 *   Test:       https://appapi2.test.bankid.com/rp/v6.0
 *   Production: https://appapi2.bankid.com/rp/v6.0
 *
 * Test certificate:
 *   File:       FPTestcert4_20230629.p12  (same cert as Swish test)
 *   Passphrase: qwerty123
 *   Download:   https://developers.bankid.com/getting-started/environments
 *
 * Required env vars:
 *   BANKID_PAY_CLIENT_ID     – Used as an identifier in your system (not a BankID concept)
 *   BANKID_PAY_CLIENT_SECRET – Used as passphrase or reference (not a BankID concept)
 *   BANKID_CERT_PATH         – Path to RP .p12 certificate (same file as SWISH_CERT_PATH)
 *   BANKID_CERT_PASSPHRASE   – .p12 passphrase (test: "qwerty123")
 *   BANKID_API_URL           – Base URL (defaults to test environment)
 *
 * NOTE: This client is separate from lib/bankid/client.ts which handles standard
 * BankID signing for agreements. This client is for BankID Pay — payment flows
 * where authentication and payment happen simultaneously.
 */

const BASE_URL         = process.env.BANKID_API_URL           ?? 'https://appapi2.test.bankid.com/rp/v6.0';
const CERT_PATH        = process.env.BANKID_CERT_PATH         ?? process.env.SWISH_CERT_PATH ?? '';
const CERT_PASSPHRASE  = process.env.BANKID_CERT_PASSPHRASE   ?? process.env.SWISH_CERT_PASSPHRASE ?? '';

// ─── mTLS HTTPS Agent ─────────────────────────────────────────────────────────

async function getAgent() {
  const [https, fs] = await Promise.all([import('https'), import('fs')]);
  const pfx = fs.readFileSync(CERT_PATH);
  return new https.Agent({ pfx, passphrase: CERT_PASSPHRASE, rejectUnauthorized: true });
}

async function bankidFetch<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const agent = await getAgent();
  // @ts-expect-error — agent is Node.js specific, not in standard fetch types
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    agent,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { errorCode?: string; details?: string };
    throw new Error(`BankID ${res.status}: ${json.errorCode ?? 'unknown'} — ${json.details ?? ''}`);
  }

  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BankIDHintCode =
  | 'outstandingTransaction'
  | 'noClient'
  | 'started'
  | 'userSign'
  | 'expiredTransaction'
  | 'certificateErr'
  | 'userCancel'
  | 'cancelled'
  | 'startFailed';

export interface BankIDAuthRequest {
  endUserIp:        string;   // customer's IP address (required)
  requirement?: {
    pinCode?:       boolean;
    mrtd?:          boolean;
    cardReader?:    'class1' | 'class2';
  };
  userVisibleData?:         string;   // base64-encoded text shown in the BankID app
  userNonVisibleData?:      string;   // base64-encoded, not shown to user
  userVisibleDataFormat?:   'simpleMarkdownV1';
}

export interface BankIDSignRequest extends BankIDAuthRequest {
  userVisibleData: string;    // required for sign (base64-encoded document text)
}

export interface BankIDOrderResponse {
  orderRef:      string;        // use this to poll /collect
  autoStartToken: string;       // used to launch BankID app via deep link
  qrStartToken:  string;        // used to generate animated QR code
  qrStartSecret: string;        // used to generate animated QR code
}

export interface BankIDCollectResponse {
  orderRef:    string;
  status:      'pending' | 'failed' | 'complete';
  hintCode?:   BankIDHintCode;
  completionData?: {
    user: {
      personalNumber: string;
      name:           string;
      givenName:      string;
      surname:        string;
    };
    device: {
      ipAddress: string;
      uhi?:      string;       // unique hardware identifier (v6.0+)
    };
    bankIdIssueDate: string;
    signature:       string;   // base64 PKCS#7 signature
    ocspResponse:    string;   // base64 OCSP response
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Initiate a BankID authentication (identity verification only).
 * Use this to verify who the customer is before starting a payment flow.
 */
export async function initiateAuth(
  endUserIp: string,
  params?: Omit<BankIDAuthRequest, 'endUserIp'>,
): Promise<BankIDOrderResponse> {
  return bankidFetch<BankIDOrderResponse>('/auth', { endUserIp, ...params });
}

/**
 * Initiate a BankID sign (shows document text in BankID app — customer signs it).
 * Used for BankID Pay: the userVisibleData should contain the payment details
 * (amount, recipient) so the customer can see and approve what they're signing.
 */
export async function initiateSign(
  endUserIp:       string,
  userVisibleData: string,   // payment details text, will be base64-encoded here
  params?: Omit<BankIDSignRequest, 'endUserIp' | 'userVisibleData'>,
): Promise<BankIDOrderResponse> {
  const encoded = Buffer.from(userVisibleData, 'utf-8').toString('base64');
  return bankidFetch<BankIDOrderResponse>('/sign', {
    endUserIp,
    userVisibleData:       encoded,
    userVisibleDataFormat: 'simpleMarkdownV1',
    ...params,
  });
}

/**
 * Poll the status of an auth or sign order.
 * Poll every 2 seconds. Stop when status is 'complete' or 'failed'.
 */
export async function collectOrder(orderRef: string): Promise<BankIDCollectResponse> {
  return bankidFetch<BankIDCollectResponse>('/collect', { orderRef });
}

/**
 * Cancel an ongoing auth or sign order.
 */
export async function cancelOrder(orderRef: string): Promise<void> {
  await bankidFetch('/cancel', { orderRef });
}

/**
 * Generate the QR code data for the current polling cycle.
 * The QR must be regenerated every second using the same qrStartToken and qrStartSecret.
 *
 * @param qrStartToken  from the /auth or /sign response
 * @param qrStartSecret from the /auth or /sign response
 * @param seconds       elapsed seconds since the order was started (0, 1, 2, …)
 */
export function generateQrData(
  qrStartToken:  string,
  qrStartSecret: string,
  seconds:       number,
): string {
  const { createHmac } = require('crypto') as typeof import('crypto');
  const time = String(seconds);
  const qrAuthCode = createHmac('sha256', qrStartSecret).update(time).digest('hex');
  return `bankid.${qrStartToken}.${time}.${qrAuthCode}`;
}
