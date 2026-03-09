/**
 * Qliro — Merchant API Client
 *
 * Product: BNPL checkout (Qliro One) for Nordic markets
 * Docs:    https://developers.qliro.com/
 * Auth:    MerchantApiKey in the JSON request body (not a header)
 *
 * Environments:
 *   Test:       https://pago.qit.nu
 *   Production: Provided by Qliro at onboarding
 *
 * Test personal numbers (Sweden):
 *   790625-5307 → Approved
 *   770530-1773 → On hold
 *   750420-8104 → Denied
 *
 * Required env vars:
 *   QLIRO_API_KEY     – Merchant API key (max 50 chars, from Qliro merchant account)
 *   QLIRO_MERCHANT_ID – Your merchant ID
 *   QLIRO_API_URL     – Base URL (defaults to test environment)
 */

const BASE_URL    = process.env.QLIRO_API_URL     ?? 'https://pago.qit.nu';
const API_KEY     = process.env.QLIRO_API_KEY     ?? '';
const MERCHANT_ID = process.env.QLIRO_MERCHANT_ID ?? '';

async function qliroFetch<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    // Qliro authenticates via the MerchantApiKey field inside every request body
    body: JSON.stringify({ MerchantApiKey: API_KEY, ...body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qliro ${res.status} ${res.statusText}: ${text}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QliroOrderItem {
  MerchantReference: string;
  Name:              string;
  Type:              'Product' | 'Fee' | 'ShippingFee' | 'Discount';
  Quantity:          number;
  PricePerItemIncVat: number;     // in SEK including VAT
  PricePerItemExVat:  number;
}

export interface QliroCustomer {
  Email?: string;
  Phone?: string;
}

export interface QliroCreateCheckoutRequest {
  MerchantOrderId:   string;       // your unique order reference
  MerchantReference: string;
  Currency:          string;       // 'SEK'
  Country:           string;       // 'SE'
  Language:          string;       // 'sv-SE'
  MerchantConfirmationUrl: string;
  MerchantNotificationUrl: string;
  OrderItems:        QliroOrderItem[];
  TotalPrice:        number;       // total in SEK including VAT
  Customer?:         QliroCustomer;
  PaymentMethodCode?: string;      // e.g. 'QliroPayLater'
  MerchantCheckoutStatusPushUrl?: string;
}

export interface QliroCheckoutResponse {
  OrderId:         number;
  MerchantOrderId: string;
  CheckoutUrl:     string;    // embed this URL in an iframe for the payment widget
  Status:          'InProgress' | 'Completed' | 'Cancelled';
}

export interface QliroOrderStatus {
  OrderId:         number;
  MerchantOrderId: string;
  Status:          'Accepted' | 'Pending' | 'Denied' | 'PaymentCaptured' | 'Refunded' | 'Cancelled';
  TotalPrice:      number;
  Currency:        string;
  CreatedAt:       string;
  Customer?: {
    NationalIdentificationNumber?: string;
    Name?: string;
    Email?: string;
  };
}

export interface QliroRefundRequest {
  OrderId:         number;
  RefundItems:     Array<{
    MerchantReference: string;
    Quantity:          number;
    PricePerItem:      number;
  }>;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Create a Qliro One checkout session.
 * Embed the returned CheckoutUrl in an iframe to display the payment widget.
 */
export async function createCheckout(
  params: QliroCreateCheckoutRequest,
): Promise<QliroCheckoutResponse> {
  return qliroFetch<QliroCheckoutResponse>('/api/checkout', params);
}

/**
 * Get current order status.
 */
export async function getOrderStatus(orderId: number): Promise<QliroOrderStatus> {
  return qliroFetch<QliroOrderStatus>('/api/order/status', {
    MerchantOrderId: String(orderId),
  });
}

/**
 * Capture payment for a confirmed order.
 * Call this after the goods have been delivered/dispatched.
 */
export async function captureOrder(orderId: number): Promise<{ Success: boolean }> {
  return qliroFetch('/api/order/capture', { OrderId: orderId });
}

/**
 * Cancel an order (before capture).
 */
export async function cancelOrder(orderId: number): Promise<{ Success: boolean }> {
  return qliroFetch('/api/order/cancel', { OrderId: orderId });
}

/**
 * Refund a captured order (partial or full).
 */
export async function refundOrder(params: QliroRefundRequest): Promise<{ Success: boolean }> {
  return qliroFetch('/api/order/refund', params);
}

/**
 * Update the order items in an existing checkout session
 * (e.g. customer removes an accessory before paying).
 */
export async function updateOrderItems(
  orderId:    number,
  orderItems: QliroOrderItem[],
  totalPrice: number,
): Promise<{ Success: boolean }> {
  return qliroFetch('/api/checkout/updateitems', {
    OrderId:    orderId,
    OrderItems: orderItems,
    TotalPrice: totalPrice,
  });
}
