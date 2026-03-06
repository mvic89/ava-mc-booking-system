/**
 * Nets Easy (formerly DIBS) — API Client
 *
 * Product: Online card payments + in-person terminal (Nets AXEPT)
 * Docs:    https://developer.nexigroup.com/nets-easy/en-EU/api/payment-v1/
 * Auth:    Secret key directly in the Authorization header — NO "Bearer" prefix
 *
 * Environments:
 *   Test:       https://test.api.dibspayment.eu
 *   Production: https://api.dibspayment.eu
 *
 * Keys are in the Nets Easy portal: Company > Integration
 *   secretKey    → server-side (never expose to browser)
 *   checkoutKey  → client-side JS (safe to expose)
 *
 * Required env vars:
 *   NETS_API_KEY      – Secret key from Nets Easy portal
 *   NETS_MERCHANT_ID  – Your merchant ID
 *   NETS_TERMINAL_ID  – Terminal ID (for AXEPT instore payments)
 *   NETS_CHECKOUT_KEY – Publishable checkout key (for frontend JS)
 *   NETS_API_URL      – Base URL (defaults to test environment)
 */

// Read credentials at call time (not module load time) so values set via
// Settings → Payment Providers take effect without a server restart.
// BASE_URL must NOT include /v1 — all path strings already start with /v1/...
function baseUrl()    { return process.env.NETS_API_URL    ?? 'https://test.api.dibspayment.eu'; }
function apiKey()     { return process.env.NETS_SECRET_KEY ?? ''; }
function merchantId() { return process.env.NETS_MERCHANT_ID ?? ''; }

async function netsFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  apiKey(),   // ← raw key, no "Bearer" prefix
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Nets ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetsOrderItem {
  reference:        string;
  name:             string;
  quantity:         number;
  unit:             string;         // 'pcs', 'kg', etc.
  unitPrice:        number;         // in minor units (öre for SEK)
  taxRate:          number;         // e.g. 2500 = 25%
  taxAmount:        number;         // in minor units
  grossTotalAmount: number;         // quantity × unitPrice + tax
  netTotalAmount:   number;         // quantity × unitPrice before tax
}

export interface NetsCreatePaymentRequest {
  order: {
    items:     NetsOrderItem[];
    amount:    number;          // total in minor units
    currency:  string;          // 'SEK'
    reference: string;          // your order reference
  };
  checkout: {
    url:           string;      // page URL where the checkout is embedded
    termsUrl:      string;
    integrationType?: 'HostedPaymentPage' | 'EmbeddedCheckout';
    returnUrl?:    string;
    cancelUrl?:    string;
    merchantHandlesConsumerData?: boolean;
  };
  notifications?: {
    webHooks: Array<{
      eventName:    string;
      url:          string;
      authorization: string;
    }>;
  };
  subscription?: {
    endDate:  string;   // ISO date
    interval: number;   // months
  };
}

export interface NetsPaymentResponse {
  paymentId:   string;
  checkoutUrl?: string;   // redirect here for hosted page
  hostedPaymentPageUrl?: string;
}

export interface NetsPayment {
  paymentId:   string;
  summary: {
    reservedAmount?:  number;
    chargedAmount?:   number;
    refundedAmount?:  number;
    cancelledAmount?: number;
  };
  consumer?: {
    firstName?:    string;
    lastName?:     string;
    email?:        string;
    phoneNumber?:  { prefix: string; number: string };
    billingAddress?: {
      addressLine1: string;
      city:         string;
      postalCode:   string;
      country:      string;
    };
  };
  paymentDetails?: {
    paymentType:   string;
    paymentMethod: string;
    cardDetails?: { maskedPan: string; expiryDate: string };
  };
  orderDetails: {
    amount:    number;
    currency:  string;
    reference: string;
  };
  created:  string;
  status?:  string;
}

export interface NetsCaptureRequest {
  amount:     number;
  orderItems: NetsOrderItem[];
}

export interface NetsRefundRequest {
  amount:     number;
  orderItems: NetsOrderItem[];
}

// ─── API calls — Online payments ──────────────────────────────────────────────

/**
 * Create a payment session. Returns a paymentId and optionally a checkoutUrl.
 * Use the paymentId with the Nets Easy JS library to render the embedded checkout,
 * or redirect the customer to checkoutUrl for hosted payment page.
 */
export async function createPayment(
  params: NetsCreatePaymentRequest,
): Promise<NetsPaymentResponse> {
  return netsFetch<NetsPaymentResponse>('/v1/payments', {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Get payment details and status.
 */
export async function getPayment(paymentId: string): Promise<NetsPayment> {
  return netsFetch<NetsPayment>(`/v1/payments/${paymentId}`);
}

/**
 * Charge (capture) a payment after authorization.
 * Call this after verifying the order is ready to be fulfilled.
 */
export async function chargePayment(
  paymentId: string,
  params:    NetsCaptureRequest,
): Promise<{ chargeId: string }> {
  return netsFetch(`/v1/payments/${paymentId}/charges`, {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Refund a charged payment (partial or full).
 */
export async function refundPayment(
  chargeId: string,
  params:   NetsRefundRequest,
): Promise<{ refundId: string }> {
  return netsFetch(`/v1/charges/${chargeId}/refunds`, {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

/**
 * Cancel a reserved (authorized but not yet charged) payment.
 */
export async function cancelPayment(
  paymentId: string,
  amount:    number,
): Promise<void> {
  await netsFetch(`/v1/payments/${paymentId}/cancels`, {
    method: 'POST',
    body:   JSON.stringify({ amount }),
  });
}

/**
 * Update order (add items to an existing payment before charge).
 */
export async function updateOrder(
  paymentId:  string,
  amount:     number,
  orderItems: NetsOrderItem[],
): Promise<void> {
  await netsFetch(`/v1/payments/${paymentId}/orderitems`, {
    method: 'PUT',
    body:   JSON.stringify({ amount, orderItems }),
  });
}

// ─── API calls — AXEPT Terminal (instore) ─────────────────────────────────────

/**
 * Initiate a terminal payment request.
 * The terminal prints a receipt automatically after the customer taps/inserts card.
 */
export async function initiateTerminalPayment(params: {
  amount:    number;
  currency:  string;
  reference: string;
  orderItems: NetsOrderItem[];
}): Promise<{ terminalPaymentId: string }> {
  return netsFetch(`/v1/terminal/payments`, {
    method: 'POST',
    body:   JSON.stringify({ ...params, merchantId: merchantId() }),
  });
}

/**
 * Get the status of a terminal payment.
 */
export async function getTerminalPayment(
  terminalPaymentId: string,
): Promise<{ status: 'Pending' | 'Approved' | 'Rejected' | 'Aborted'; amount: number }> {
  return netsFetch(`/v1/terminal/payments/${terminalPaymentId}`);
}

/**
 * Cancel an ongoing terminal payment (before the customer completes it).
 */
export async function cancelTerminalPayment(terminalPaymentId: string): Promise<void> {
  await netsFetch(`/v1/terminal/payments/${terminalPaymentId}/cancel`, { method: 'POST' });
}
