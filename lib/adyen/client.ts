/**
 * Adyen — API Client (Online Checkout + Terminal/POS)
 *
 * Docs:    https://docs.adyen.com/
 * Auth:    X-API-Key header (no OAuth2 for standard integrations)
 *
 * Environments:
 *   Test management: https://management-test.adyen.com/v3
 *   Test checkout:   https://checkout-test.adyen.com/v71
 *   Test balance:    https://balanceplatform-api-test.adyen.com/bcl/v2
 *   Production:      Region-specific (Customer Area > Developers > API URLs)
 *
 * API key generation: Customer Area → Developers → API credentials → Authentication
 * Old key remains valid 24 hours after rotation.
 *
 * Required env vars:
 *   ADYEN_API_KEY           – API key (from Customer Area)
 *   ADYEN_MERCHANT_ACCOUNT  – Merchant account name (e.g. "AvaMCECOM")
 *   ADYEN_CLIENT_KEY        – Publishable client key (for frontend/Drop-in component)
 *   ADYEN_TERMINAL_ID       – Terminal serial number for instore (e.g. "P400Plus-123456789")
 *   ADYEN_MANAGEMENT_URL    – Management API base URL (defaults to test)
 *   ADYEN_CHECKOUT_URL      – Checkout API base URL (defaults to test)
 */

const MANAGEMENT_URL    = process.env.ADYEN_MANAGEMENT_URL   ?? 'https://management-test.adyen.com/v3';
const CHECKOUT_URL      = process.env.ADYEN_CHECKOUT_URL     ?? 'https://checkout-test.adyen.com/v71';
const API_KEY           = process.env.ADYEN_API_KEY          ?? '';
const MERCHANT_ACCOUNT  = process.env.ADYEN_MERCHANT_ACCOUNT ?? '';
const TERMINAL_ID       = process.env.ADYEN_TERMINAL_ID      ?? '';

function adyenHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key':    API_KEY,
  };
}

async function adyenFetch<T = unknown>(
  baseUrl: string,
  path:    string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...adyenHeaders(), ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Adyen ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

const management = <T>(path: string, options?: RequestInit) =>
  adyenFetch<T>(MANAGEMENT_URL, path, options);

const checkout = <T>(path: string, options?: RequestInit) =>
  adyenFetch<T>(CHECKOUT_URL, path, options);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdyenAmount {
  currency: string;   // 'SEK'
  value:    number;   // in minor units (öre)
}

export interface AdyenLineItem {
  id:               string;
  description:      string;
  quantity:         number;
  amountIncludingTax: number;   // in minor units
  taxAmount:        number;     // in minor units
  taxPercentage:    number;     // e.g. 2500 = 25%
}

export interface AdyenPaymentSessionRequest {
  merchantAccount:   string;
  amount:            AdyenAmount;
  reference:         string;      // your order reference
  returnUrl:         string;      // customer redirect URL after payment
  countryCode:       string;      // 'SE'
  shopperLocale?:    string;      // 'sv-SE'
  shopperEmail?:     string;
  shopperReference?: string;      // unique customer ID for recurring
  lineItems?:        AdyenLineItem[];
  channel?:          'Web' | 'iOS' | 'Android';
  storePaymentMethod?: boolean;   // save card for future use
}

export interface AdyenPaymentSessionResponse {
  id:            string;
  sessionData:   string;   // pass to Drop-in/Components frontend
  expiresAt:     string;
  amount:        AdyenAmount;
  returnUrl:     string;
  reference:     string;
  status:        string;
}

export interface AdyenPaymentDetailsRequest {
  paymentData:  string;
  details:      Record<string, string>;
}

export interface AdyenPaymentResult {
  pspReference:    string;
  resultCode:      'Authorised' | 'Refused' | 'Cancelled' | 'Received' | 'Pending' | 'Error';
  refusalReason?:  string;
  action?:         Record<string, unknown>;   // redirect / 3DS action
}

export interface AdyenCaptureRequest {
  merchantAccount: string;
  amount:          AdyenAmount;
  reference?:      string;
  lineItems?:      AdyenLineItem[];
}

export interface AdyenRefundRequest {
  merchantAccount: string;
  amount:          AdyenAmount;
  reference?:      string;
  lineItems?:      AdyenLineItem[];
}

export interface AdyenTerminal {
  id:              string;
  status:          string;
  serialNumber:    string;
  model:           string;
  merchantAccount?: string;
  store?:           string;
  lastActivityAt?:  string;
}

// ─── Checkout API — Online payments ───────────────────────────────────────────

/**
 * Create a payment session — pass sessionData to the Adyen Drop-in or Components
 * frontend library to render the payment form.
 */
export async function createPaymentSession(
  params: AdyenPaymentSessionRequest,
): Promise<AdyenPaymentSessionResponse> {
  return checkout<AdyenPaymentSessionResponse>('/sessions', {
    method: 'POST',
    body:   JSON.stringify({ merchantAccount: MERCHANT_ACCOUNT, ...params }),
  });
}

/**
 * Submit additional payment details (e.g. after 3DS redirect).
 */
export async function submitPaymentDetails(
  params: AdyenPaymentDetailsRequest,
): Promise<AdyenPaymentResult> {
  return checkout<AdyenPaymentResult>('/payments/details', {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Capture (charge) an authorized payment.
 */
export async function capturePayment(
  pspReference: string,
  params:       AdyenCaptureRequest,
): Promise<{ pspReference: string; status: string }> {
  return checkout<{ pspReference: string; status: string }>(
    `/payments/${pspReference}/captures`,
    { method: 'POST', body: JSON.stringify({ merchantAccount: MERCHANT_ACCOUNT, ...params }) },
  );
}

/**
 * Refund a captured payment.
 */
export async function refundPayment(
  pspReference: string,
  params:       AdyenRefundRequest,
): Promise<{ pspReference: string; status: string }> {
  return checkout<{ pspReference: string; status: string }>(
    `/payments/${pspReference}/refunds`,
    { method: 'POST', body: JSON.stringify({ merchantAccount: MERCHANT_ACCOUNT, ...params }) },
  );
}

/**
 * Cancel an authorized (not yet captured) payment.
 */
export async function cancelPayment(
  pspReference: string,
): Promise<{ pspReference: string; status: string }> {
  return checkout<{ pspReference: string; status: string }>(
    `/payments/${pspReference}/cancels`,
    { method: 'POST', body: JSON.stringify({ merchantAccount: MERCHANT_ACCOUNT }) },
  );
}

// ─── Terminal API — Instore (NEXO cloud) ──────────────────────────────────────

const TERMINAL_API_URL = 'https://terminal-api-test.adyen.com/sync';

/**
 * Initiate a card payment on the physical Adyen terminal.
 * The terminal will prompt the customer to tap/insert their card.
 */
export async function initiateTerminalPayment(params: {
  amount:    AdyenAmount;
  reference: string;
}): Promise<{ SaleToPOIResponse: Record<string, unknown> }> {
  const res = await fetch(TERMINAL_API_URL, {
    method:  'POST',
    headers: adyenHeaders(),
    body: JSON.stringify({
      SaleToPOIRequest: {
        MessageHeader: {
          ProtocolVersion:  '3.0',
          MessageClass:     'Service',
          MessageCategory:  'Payment',
          MessageType:      'Request',
          ServiceID:        params.reference,
          SaleID:           'AvaMCSale',
          POIID:            TERMINAL_ID,
        },
        PaymentRequest: {
          SaleData: {
            SaleTransactionID: {
              TransactionID: params.reference,
              TimeStamp:     new Date().toISOString(),
            },
          },
          PaymentTransaction: {
            AmountsReq: {
              Currency:       params.amount.currency,
              RequestedAmount: params.amount.value / 100,
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Adyen Terminal ${res.status}: ${body}`);
  }

  return res.json();
}

// ─── Management API — Account configuration ───────────────────────────────────

/**
 * Get merchant account details.
 */
export async function getMerchantAccount(): Promise<Record<string, unknown>> {
  return management(`/merchants/${MERCHANT_ACCOUNT}`);
}

/**
 * List all terminals under this merchant account.
 */
export async function listTerminals(): Promise<{ data: AdyenTerminal[]; totalItems: number }> {
  return management(`/merchants/${MERCHANT_ACCOUNT}/terminals`);
}

/**
 * Get details for a specific terminal.
 */
export async function getTerminal(
  terminalId: string = TERMINAL_ID,
): Promise<AdyenTerminal> {
  return management(`/merchants/${MERCHANT_ACCOUNT}/terminals/${terminalId}`);
}
