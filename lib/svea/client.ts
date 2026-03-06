import { sveaBasicAuthHeader, sveaHmacHeaders } from './auth';

/**
 * Svea API Client
 *
 * Three APIs mapped from the Postman collections:
 *
 * 1. Instore API  (webpayinstoreapistage.svea.com)
 *    → Best for motorcycle dealerships: dealer creates order in DMS,
 *      customer receives SMS link to complete payment/financing on their phone.
 *      RequireElectronicIdAuthentication: true → BankID required.
 *    Auth: Basic Auth (username + password)
 *
 * 2. Checkout API (checkoutapistage.svea.com)
 *    → For embedded web checkout (not needed for instore sales)
 *    Auth: HMAC-SHA512
 *
 * 3. Admin/External API (paymentadminapistage.svea.com)
 *    → Order management: GET order, deliver order, cancel, callbacks
 *    Auth: HMAC-SHA512
 *
 * Stage (test) URLs are used when SVEA_STAGE=true. Remove the "stage" parts
 * from the URLs when going to production.
 */

// ─── URL helpers ─────────────────────────────────────────────────────────────

function instoreUrl(path: string) {
  const base = process.env.SVEA_INSTORE_API_URL
    ?? 'https://webpayinstoreapistage.svea.com';
  return `${base}${path}`;
}

function adminUrl(path: string) {
  const base = process.env.SVEA_EXTERNAL_API_URL
    ?? 'https://paymentadminapistage.svea.com';
  return `${base}${path}`;
}

function checkoutUrl(path: string) {
  const base = process.env.SVEA_CHECKOUT_API_URL
    ?? 'https://checkoutapistage.svea.com';
  return `${base}${path}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SveaOrderItem {
  ArticleNumber: string;
  Name: string;
  Quantity: number;      // × 100 (e.g. 1 unit = 100)
  UnitPrice: number;     // in öre (SEK × 100)
  DiscountPercent: number;
  DiscountAmount: number;
  VatPercent: number;    // 2500 = 25%
  Unit: string;
  RowNumber: number;
}

export interface CreateInstoreOrderParams {
  merchantOrderNumber: string;  // your internal reference, e.g. "AGR-2024-0089"
  customerPhone: string;        // +46700000000
  callbackUri: string;          // your /api/svea/callback endpoint
  termsUri: string;             // your terms page URL
  items: SveaOrderItem[];
  minutesUntilLinkExpires?: number;  // default 20
}

export interface SveaInstoreOrderResponse {
  // Real field names returned by Svea Instore API (confirmed from stage response)
  paymentOrderId: number;
  orderStatus: string;             // "Active" after create; "Confirmed" after BankID sign
  instoreUiUri?: string;           // direct payment URL sent to customer via SMS
  smsSentSuccessfully?: boolean;   // true = SMS handed to operator (not guaranteed delivery)
  merchantOrderNumber?: string;
}

export interface SveaGetOrderResponse {
  OrderId: number;
  Status: string;           // "Created" | "Confirmed" | "Delivered" | "Cancelled"
  ClientOrderNumber: string;
  OrderAmount: number;
  Customer?: {
    NationalId: string;
    Name: string;
    Email: string;
  };
  PaymentType?: string;
  CreatedDate?: string;
}

// ─── Instore API ──────────────────────────────────────────────────────────────

/**
 * Create an in-store order. Svea sends an SMS to the customer's phone with
 * a payment link. The customer selects a financing plan and signs with BankID.
 *
 * POST /api/v1/orders
 * Auth: Basic Auth
 *
 * From the Instore Postman collection:
 * - MobilePhoneNumber: "+46700000000"
 * - RequireElectronicIdAuthentication: true  (forces BankID)
 * - DeferredDelivery: false
 * - MinutesUntilLinkExpires: 20
 */
export async function createInstoreOrder(
  params: CreateInstoreOrderParams,
): Promise<SveaInstoreOrderResponse> {
  const body = JSON.stringify({
    MerchantOrderNumber: params.merchantOrderNumber,
    CountryCode: 'SE',
    Currency: 'SEK',
    MobilePhoneNumber: params.customerPhone,
    OrderItems: params.items,
    CallbackUri: params.callbackUri,
    TermsUri: params.termsUri,
    DeferredDelivery: false,
    MinutesUntilLinkExpires: params.minutesUntilLinkExpires ?? 20,
    MerchantName: process.env.SVEA_MERCHANT_NAME ?? 'AVA MC AB',
    RequireElectronicIdAuthentication: true,  // forces BankID for customer
  });

  const res = await fetch(instoreUrl('/api/v1/orders'), {
    method: 'POST',
    headers: sveaBasicAuthHeader(),
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea createInstoreOrder failed ${res.status}: ${err}`);
  }

  return res.json();
}

// ─── Instore Order Status ─────────────────────────────────────────────────────

export interface SveaInstoreStatusResponse {
  // Svea Instore status fields — using camelCase like the create response
  paymentOrderId?: number;
  orderStatus?: string;            // "Active" | "Confirmed" | "Cancelled"
  merchantOrderNumber?: string;
  // PascalCase fallbacks in case status endpoint differs
  OrderId?: number;
  Status?: string;
  MerchantOrderNumber?: string;
}

/**
 * Get the current status of an instore order.
 * GET /api/v1/orders/{orderId}/status
 * Auth: Basic Auth (same credentials as createInstoreOrder)
 *
 * From the Instore Postman collection (Get Order Status).
 * Use this to poll after createInstoreOrder — NOT the Payment Admin API.
 */
export async function getInstoreOrderStatus(
  orderId: number | string,
): Promise<SveaInstoreStatusResponse> {
  const res = await fetch(instoreUrl(`/api/v1/orders/${orderId}/status`), {
    method: 'GET',
    headers: sveaBasicAuthHeader(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea getInstoreOrderStatus failed ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Cancel an instore order.
 * POST /api/v1/orders/{orderId}/cancel
 * Auth: Basic Auth
 *
 * From the Instore Postman collection (Cancel Instore Order).
 */
export async function cancelInstoreOrder(orderId: number | string): Promise<void> {
  const res = await fetch(instoreUrl(`/api/v1/orders/${orderId}/cancel`), {
    method: 'POST',
    headers: sveaBasicAuthHeader(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea cancelInstoreOrder failed ${res.status}: ${err}`);
  }
}

// ─── Admin / Order Management API ─────────────────────────────────────────────

/**
 * Get order details and current status via the Payment Admin API.
 * GET /api/v1/orders/{orderId}
 * Auth: HMAC-SHA512
 *
 * Use for checkout orders or post-delivery management.
 * For instore order polling, use getInstoreOrderStatus() instead.
 * Status values: "Created" | "Confirmed" | "Delivered" | "Cancelled" | "Error"
 */
export async function getOrder(orderId: number | string): Promise<SveaGetOrderResponse> {
  const headers = sveaHmacHeaders('', 'GET');

  const res = await fetch(adminUrl(`/api/v1/orders/${orderId}`), {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea getOrder failed ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Deliver an order (triggers Svea to release funds to the dealer).
 * Call this when the bike is physically handed over to the customer.
 *
 * POST /api/v1/orders/{orderId}/deliveries
 * Auth: HMAC-SHA512
 * Body: { "OrderRowIds": [] }  (empty = deliver all rows)
 *
 * From the Order Management Postman collection (DeliverOrder).
 */
export async function deliverOrder(orderId: number | string): Promise<void> {
  const body = JSON.stringify({ OrderRowIds: [] });
  const headers = sveaHmacHeaders(body, 'POST');

  const res = await fetch(adminUrl(`/api/v1/orders/${orderId}/deliveries`), {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea deliverOrder failed ${res.status}: ${err}`);
  }
}

/**
 * Cancel an order.
 * POST /api/v1/orders/{orderId}/cancellations
 * Auth: HMAC-SHA512
 *
 * From the Order Management Postman collection (CancelOrder).
 */
export async function cancelOrder(orderId: number | string): Promise<void> {
  const body = JSON.stringify({});
  const headers = sveaHmacHeaders(body, 'POST');

  const res = await fetch(adminUrl(`/api/v1/orders/${orderId}/cancellations`), {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea cancelOrder failed ${res.status}: ${err}`);
  }
}

// ─── Callback Subscription (Admin API) ───────────────────────────────────────

/**
 * Register a webhook subscription to receive order events.
 * Run this once during setup — not on every order.
 *
 * POST /api/v2/callbacks/subscriptions
 * Events: CheckoutOrder.Created | CheckoutOrder.Delivered |
 *         CheckoutOrder.CreditSucceeded | CheckoutOrder.CreditFailed |
 *         CheckoutOrder.Closed | CheckoutOrder.Updated
 *
 * From the Callback Postman collection.
 */
export async function registerCallbackSubscription(callbackUri: string): Promise<void> {
  const body = JSON.stringify({
    CallbackUri: callbackUri,
    Events: [
      'CheckoutOrder.Created',
      'CheckoutOrder.Delivered',
      'CheckoutOrder.CreditSucceeded',
      'CheckoutOrder.CreditFailed',
      'CheckoutOrder.Closed',
      'CheckoutOrder.Updated',
    ],
  });

  const headers = sveaHmacHeaders(body, 'POST');

  const res = await fetch(adminUrl('/api/v2/callbacks/subscriptions'), {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea registerCallbackSubscription failed ${res.status}: ${err}`);
  }
}

// ─── Instore: Return Order ────────────────────────────────────────────────────

export interface SveaReturnItem {
  RowNumber:     number;
  Quantity:      number;   // × 100
  UnitPrice:     number;   // in öre
  VatPercent:    number;   // e.g. 2500 = 25%
  ArticleNumber?: string;
  Name?:          string;
}

/**
 * Return a completed instore order (partial or full refund).
 * POST /api/v1/orders/{merchantOrderNumber}/return
 * Auth: Basic Auth
 */
export async function returnInstoreOrder(
  merchantOrderNumber: string,
  returnedItems: SveaReturnItem[],
): Promise<void> {
  const body = JSON.stringify({ ReturnedItems: returnedItems });
  const res  = await fetch(instoreUrl(`/api/v1/orders/${merchantOrderNumber}/return`), {
    method:  'POST',
    headers: sveaBasicAuthHeader(),
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea returnInstoreOrder failed ${res.status}: ${err}`);
  }
}

// ─── Admin API: Deliver at lower amount ──────────────────────────────────────

export interface SveaDeliveryResponse { DeliveryId: number }

/**
 * Deliver an order at a lower total amount than originally authorised.
 * POST /api/v1/orders/{orderId}/deliveries/DeliverAndLowerAmount
 * Auth: HMAC-SHA512
 */
export async function deliverOrderLowerAmount(
  orderId: number | string,
  deliveredAmount: number,  // in öre
): Promise<SveaDeliveryResponse> {
  const body    = JSON.stringify({ DeliveredAmount: deliveredAmount });
  const headers = sveaHmacHeaders(body, 'POST');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/deliveries/DeliverAndLowerAmount`), {
    method: 'POST', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea deliverOrderLowerAmount failed ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Admin API: Cancel order rows ─────────────────────────────────────────────

/**
 * Cancel a single order row.
 * PATCH /api/v1/orders/{orderId}/rows/{rowId}/
 * Auth: HMAC-SHA512
 */
export async function cancelOrderRow(
  orderId: number | string,
  rowId:   number,
): Promise<void> {
  const body    = JSON.stringify({ IsCancelled: true });
  const headers = sveaHmacHeaders(body, 'PATCH');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/rows/${rowId}/`), {
    method: 'PATCH', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea cancelOrderRow failed ${res.status}: ${err}`);
  }
}

/**
 * Cancel multiple order rows at once.
 * PATCH /api/v1/orders/{orderId}/rows/cancelOrderRows/
 * Auth: HMAC-SHA512
 */
export async function cancelOrderRows(
  orderId: number | string,
  rowIds:  number[],
): Promise<void> {
  const body    = JSON.stringify({ OrderRowIds: rowIds });
  const headers = sveaHmacHeaders(body, 'PATCH');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/rows/cancelOrderRows/`), {
    method: 'PATCH', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea cancelOrderRows failed ${res.status}: ${err}`);
  }
}

// ─── Admin API: Edit order rows ───────────────────────────────────────────────

export interface SveaOrderRowInput {
  ArticleNumber?:  string;
  Name:            string;
  Quantity:        number;  // × 100
  UnitPrice:       number;  // in öre
  DiscountPercent?: number;
  DiscountAmount?:  number;
  VatPercent:      number;  // e.g. 2500 = 25%
  Unit?:           string;
}

/**
 * Add a single row to an existing order.
 * POST /api/v1/orders/{orderId}/rows/
 */
export async function addOrderRow(
  orderId: number | string,
  row: SveaOrderRowInput,
): Promise<{ OrderRowId: number }> {
  const body    = JSON.stringify(row);
  const headers = sveaHmacHeaders(body, 'POST');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/rows/`), {
    method: 'POST', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea addOrderRow failed ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Add multiple rows to an existing order.
 * POST /api/v1/orders/{orderId}/rows/addOrderRows/
 */
export async function addOrderRows(
  orderId: number | string,
  rows: SveaOrderRowInput[],
): Promise<{ OrderRowIds: number[] }> {
  const body    = JSON.stringify({ OrderRows: rows });
  const headers = sveaHmacHeaders(body, 'POST');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/rows/addOrderRows/`), {
    method: 'POST', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea addOrderRows failed ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Update a single existing order row.
 * PATCH /api/v1/orders/{orderId}/rows/{rowId}/
 */
export async function updateOrderRow(
  orderId:  number | string,
  rowId:    number,
  updates:  Partial<SveaOrderRowInput>,
): Promise<void> {
  const body    = JSON.stringify(updates);
  const headers = sveaHmacHeaders(body, 'PATCH');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/rows/${rowId}/`), {
    method: 'PATCH', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea updateOrderRow failed ${res.status}: ${err}`);
  }
}

/**
 * Update multiple order rows at once.
 * POST /api/v1/orders/{orderId}/rows/updateOrderRows/
 */
export async function updateOrderRows(
  orderId: number | string,
  rows: (SveaOrderRowInput & { OrderRowId: number })[],
): Promise<void> {
  const body    = JSON.stringify({ OrderRows: rows });
  const headers = sveaHmacHeaders(body, 'POST');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/rows/updateOrderRows/`), {
    method: 'POST', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea updateOrderRows failed ${res.status}: ${err}`);
  }
}

/**
 * Replace ALL order rows with a new set (old rows are cancelled).
 * PUT /api/v1/orders/{orderId}/rows/replaceOrderRows
 */
export async function replaceOrderRows(
  orderId: number | string,
  rows: SveaOrderRowInput[],
): Promise<void> {
  const body    = JSON.stringify({ OrderRows: rows });
  const headers = sveaHmacHeaders(body, 'PUT');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/rows/replaceOrderRows`), {
    method: 'PUT', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea replaceOrderRows failed ${res.status}: ${err}`);
  }
}

/**
 * Extend an order's expiry date.
 * PATCH /api/v1/orders/{orderId}/extendOrder/{expiryDate}/
 */
export async function extendOrder(
  orderId:    number | string,
  expiryDate: string,  // ISO 8601, e.g. "2024-12-31"
): Promise<void> {
  const headers = sveaHmacHeaders('', 'PATCH');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/extendOrder/${expiryDate}/`), {
    method: 'PATCH', headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea extendOrder failed ${res.status}: ${err}`);
  }
}

// ─── Admin API: Credits ───────────────────────────────────────────────────────

export interface SveaCreditResponse { CreditId: number }

export interface SveaFeeRow {
  Name:            string;
  Quantity:        number;
  UnitPrice:       number;
  VatPercent:      number;
  DiscountPercent?: number;
}

/**
 * Credit specific delivered order rows.
 * POST /api/v1/orders/{orderId}/deliveries/{deliveryId}/credits/
 */
export async function creditOrderRows(
  orderId:    number | string,
  deliveryId: number | string,
  rowIds:     number[],
): Promise<SveaCreditResponse> {
  const body    = JSON.stringify({ OrderRowIds: rowIds });
  const headers = sveaHmacHeaders(body, 'POST');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/deliveries/${deliveryId}/credits/`), {
    method: 'POST', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea creditOrderRows failed ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Credit order rows and optionally add a fee row.
 * POST /api/v1/orders/{orderId}/deliveries/{deliveryId}/credits/CreditWithFee
 */
export async function creditOrderRowsWithFee(
  orderId:    number | string,
  deliveryId: number | string,
  rowIds:     number[],
  fee?:       SveaFeeRow,
): Promise<SveaCreditResponse> {
  const body    = JSON.stringify({ OrderRowIds: rowIds, ...(fee ? { Fee: fee } : {}) });
  const headers = sveaHmacHeaders(body, 'POST');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/deliveries/${deliveryId}/credits/CreditWithFee`), {
    method: 'POST', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea creditOrderRowsWithFee failed ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Credit a specific monetary amount without specifying rows.
 * PATCH /api/v1/orders/{orderId}/deliveries/{deliveryId}/
 */
export async function creditDeliveryAmount(
  orderId:       number | string,
  deliveryId:    number | string,
  creditedAmount: number,  // in öre
): Promise<SveaCreditResponse> {
  const body    = JSON.stringify({ CreditedAmount: creditedAmount });
  const headers = sveaHmacHeaders(body, 'PATCH');
  const res     = await fetch(adminUrl(`/api/v1/orders/${orderId}/deliveries/${deliveryId}/`), {
    method: 'PATCH', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea creditDeliveryAmount failed ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Admin API: Reports ───────────────────────────────────────────────────────

export interface SveaReportRow {
  OrderId:           number;
  Amount:            number;
  PayoutDate:        string;
  PaymentType:       string;
  ClientOrderNumber: string;
}
export interface SveaReportResponse {
  Rows:         SveaReportRow[];
  TotalAmount?: number;
}

/**
 * Get payout/reconciliation report for a date.
 * GET /api/v2/reports?date={date}&includeWithholding={bool}
 * Auth: HMAC-SHA512
 */
export async function getReport(
  date: string,               // ISO 8601, e.g. "2024-06-15"
  includeWithholding = false,
): Promise<SveaReportResponse> {
  const params  = new URLSearchParams({ date, includeWithholding: String(includeWithholding) });
  const headers = sveaHmacHeaders('', 'GET');
  const res     = await fetch(adminUrl(`/api/v2/reports?${params}`), {
    method: 'GET', headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea getReport failed ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Checkout API ─────────────────────────────────────────────────────────────

export interface SveaCheckoutOrderLine {
  ArticleNumber?:    string;
  Name:              string;
  Quantity:          number;
  UnitPrice:         number;  // in öre
  DiscountPercent?:  number;
  DiscountAmount?:   number;
  VatPercent:        number;
  Unit?:             string;
  TemporaryReference?: string;
}

export interface SveaCheckoutOrderRequest {
  MerchantSettings: {
    TermsUri:        string;
    CheckoutUri:     string;
    ConfirmationUri: string;
    PushUri:         string;
  };
  Cart: { Items: SveaCheckoutOrderLine[] };
  Currency:          string;  // 'SEK'
  CountryCode:       string;  // 'SE'
  Locale:            string;  // 'sv-SE'
  ClientOrderNumber?: string;
  MerchantData?:     string;
  PresetValues?:     object;
}

export interface SveaCheckoutOrderResponse {
  OrderId:           number;
  Status:            string;
  Snippet:           string;  // HTML to embed the checkout widget
  ClientOrderNumber?: string;
  Currency:          string;
  CountryCode:       string;
  OrderAmount:       number;
  Cart?:             { Items: SveaCheckoutOrderLine[] };
  Customer?:         { NationalId?: string; Name?: string; Email?: string };
  PaymentType?:      string;
  CreatedDate?:      string;
  ExpirationDate?:   string;
}

export interface SveaCampaign {
  CampaignCode:                number;
  Description:                 string;
  PaymentPlanType:             number;
  ContractLengthInMonths:      number;
  MonthlyAnnuityFactor:        number;
  InitialFee:                  number;
  NotificationFee:             number;
  InterestRatePercent:         number;
  NumberOfInterestFreeMonths:  number;
  NumberOfPaymentFreeMonths:   number;
  FromAmount:                  number;
  ToAmount:                    number;
}

/**
 * Create a Checkout order (embeds the Svea checkout widget in your page).
 * POST /api/orders
 * Auth: HMAC-SHA512
 * Returns OrderId + HTML Snippet to embed.
 */
export async function createCheckoutOrder(
  params: SveaCheckoutOrderRequest,
): Promise<SveaCheckoutOrderResponse> {
  const body    = JSON.stringify(params);
  const headers = sveaHmacHeaders(body, 'POST');
  const res     = await fetch(checkoutUrl('/api/orders'), {
    method: 'POST', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea createCheckoutOrder failed ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Get a Checkout order by ID.
 * GET /api/orders/{orderId}
 * Auth: HMAC-SHA512
 */
export async function getCheckoutOrder(
  orderId: number | string,
): Promise<SveaCheckoutOrderResponse> {
  const headers = sveaHmacHeaders('', 'GET');
  const res     = await fetch(checkoutUrl(`/api/orders/${orderId}`), {
    method: 'GET', headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea getCheckoutOrder failed ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Update a Checkout order's cart or merchantData.
 * PUT /api/orders/{orderId}
 * Auth: HMAC-SHA512
 */
export async function updateCheckoutOrder(
  orderId: number | string,
  updates: { Cart?: { Items: SveaCheckoutOrderLine[] }; MerchantData?: string },
): Promise<void> {
  const body    = JSON.stringify(updates);
  const headers = sveaHmacHeaders(body, 'PUT');
  const res     = await fetch(checkoutUrl(`/api/orders/${orderId}`), {
    method: 'PUT', headers, body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea updateCheckoutOrder failed ${res.status}: ${err}`);
  }
}

/**
 * Get available part-payment campaigns.
 * GET /api/util/GetAvailablePartPaymentCampaigns?isCompany={bool}&amount={decimal}
 * Auth: HMAC-SHA512
 */
export async function getAvailableCampaigns(
  isCompany: boolean,
  amount:    number,   // in öre
): Promise<SveaCampaign[]> {
  const params  = new URLSearchParams({ isCompany: String(isCompany), amount: String(amount) });
  const headers = sveaHmacHeaders('', 'GET');
  const res     = await fetch(checkoutUrl(`/api/util/GetAvailablePartPaymentCampaigns?${params}`), {
    method: 'GET', headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Svea getAvailableCampaigns failed ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a SveaOrderItem from agreement data.
 * UnitPrice is in öre (SEK × 100). Quantity × 100 = 1 unit.
 */
export function agreementToSveaItem(
  vin: string,
  vehicleName: string,
  priceInSek: number,
  vatPercent: number = 25,
): SveaOrderItem {
  return {
    ArticleNumber: vin,
    Name: vehicleName,
    Quantity: 100,          // 1 unit × 100
    UnitPrice: priceInSek * 100,   // SEK → öre
    DiscountPercent: 0,
    DiscountAmount: 0,
    VatPercent: vatPercent * 100,  // 25 → 2500
    Unit: 'st',
    RowNumber: 1,
  };
}
