/**
 * Stripe — API Client (Online Payments + Stripe Terminal)
 *
 * Docs:    https://stripe.com/docs/api
 * Auth:    Authorization: Bearer sk_test_…  (test) / sk_live_… (production)
 *          Same API URL for both — the key prefix determines the mode.
 *
 * Environments:
 *   Test and production: https://api.stripe.com/v1/
 *   Mode is determined by the key prefix:
 *     sk_test_… → test mode (no real charges)
 *     sk_live_… → production
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      – Server-side secret key (never expose to browser)
 *   STRIPE_PUBLISHABLE_KEY – Client-side publishable key (safe to expose)
 *   STRIPE_WEBHOOK_SECRET  – Webhook signing secret (whsec_…) for verifying events
 *   STRIPE_LOCATION_ID     – Terminal location ID (for Stripe Terminal only)
 */

const BASE_URL         = 'https://api.stripe.com/v1';
const SECRET_KEY       = process.env.STRIPE_SECRET_KEY      ?? '';
const WEBHOOK_SECRET   = process.env.STRIPE_WEBHOOK_SECRET  ?? '';
const LOCATION_ID      = process.env.STRIPE_LOCATION_ID     ?? '';

function stripeHeaders() {
  return {
    Authorization:  `Bearer ${SECRET_KEY}`,
    'Stripe-Version': '2024-06-20',
  };
}

async function stripeFetch<T = unknown>(
  path:    string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...stripeHeaders(), ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message: string } };
    throw new Error(`Stripe ${res.status}: ${body.error?.message ?? res.statusText}`);
  }

  return res.json() as T;
}

/** Encode a plain object as application/x-www-form-urlencoded (Stripe's format). */
function encode(obj: Record<string, unknown>, prefix = ''): string {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) return [];
    if (typeof v === 'object' && !Array.isArray(v)) return encode(v as Record<string, unknown>, key);
    return [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`];
  }).join('&');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type StripeCurrency = 'sek' | 'nok' | 'eur' | 'dkk' | 'gbp' | 'usd';

export interface StripePaymentIntent {
  id:              string;
  amount:          number;        // in minor units (öre for SEK)
  currency:        StripeCurrency;
  status:          'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  client_secret:   string;        // pass to Stripe.js on the frontend
  payment_method?: string;
  metadata?:       Record<string, string>;
  created:         number;
}

export interface StripeCustomer {
  id:       string;
  email?:   string;
  name?:    string;
  phone?:   string;
  metadata?: Record<string, string>;
  created:  number;
}

export interface StripeRefund {
  id:                string;
  amount:            number;
  currency:          StripeCurrency;
  status:            'pending' | 'succeeded' | 'failed' | 'canceled';
  payment_intent:    string;
  reason?:           string;
  created:           number;
}

export interface StripeSubscription {
  id:          string;
  status:      'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'trialing';
  customer:    string;
  current_period_start: number;
  current_period_end:   number;
  items: { data: Array<{ price: { id: string; unit_amount: number; currency: string } }> };
}

export interface StripeWebhookEvent {
  id:       string;
  type:     string;
  data:     { object: Record<string, unknown> };
  created:  number;
}

// ─── API calls — Online payments ──────────────────────────────────────────────

/**
 * Create a PaymentIntent.
 * Pass client_secret to Stripe.js on the frontend to render the payment form.
 * For manual capture (authorize first, charge after delivery): set capture_method: 'manual'
 */
export async function createPaymentIntent(params: {
  amount:          number;
  currency:        StripeCurrency;
  description?:    string;
  metadata?:       Record<string, string>;
  customer?:       string;
  captureMethod?:  'automatic' | 'manual';
  setupFutureUsage?: 'on_session' | 'off_session';
}): Promise<StripePaymentIntent> {
  return stripeFetch<StripePaymentIntent>('/payment_intents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode({
      amount:           params.amount,
      currency:         params.currency,
      description:      params.description ?? '',
      customer:         params.customer ?? '',
      capture_method:   params.captureMethod ?? 'automatic',
      setup_future_usage: params.setupFutureUsage ?? '',
      metadata:         params.metadata ?? {},
    }),
  });
}

/**
 * Retrieve a PaymentIntent by ID.
 */
export async function getPaymentIntent(id: string): Promise<StripePaymentIntent> {
  return stripeFetch<StripePaymentIntent>(`/payment_intents/${id}`);
}

/**
 * Capture a PaymentIntent that was authorized with capture_method: 'manual'.
 * Call this when the vehicle is delivered / order is confirmed.
 */
export async function capturePaymentIntent(
  id:     string,
  amount?: number,   // capture partial amount if provided
): Promise<StripePaymentIntent> {
  return stripeFetch<StripePaymentIntent>(`/payment_intents/${id}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: amount ? encode({ amount_to_capture: amount }) : '',
  });
}

/**
 * Cancel a PaymentIntent (before capture).
 */
export async function cancelPaymentIntent(id: string): Promise<StripePaymentIntent> {
  return stripeFetch<StripePaymentIntent>(`/payment_intents/${id}/cancel`, { method: 'POST' });
}

/**
 * Refund a PaymentIntent (partial or full).
 */
export async function refundPayment(params: {
  payment_intent: string;
  amount?:        number;
  reason?:        'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<StripeRefund> {
  return stripeFetch<StripeRefund>('/refunds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode(params),
  });
}

// ─── Customers ────────────────────────────────────────────────────────────────

/**
 * Create or update a Stripe customer (for saving cards / subscriptions).
 */
export async function createCustomer(params: {
  email?:    string;
  name?:     string;
  phone?:    string;
  metadata?: Record<string, string>;
}): Promise<StripeCustomer> {
  return stripeFetch<StripeCustomer>('/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode(params),
  });
}

/**
 * Get a customer by ID.
 */
export async function getCustomer(id: string): Promise<StripeCustomer> {
  return stripeFetch<StripeCustomer>(`/customers/${id}`);
}

// ─── Subscriptions (recurring) ────────────────────────────────────────────────

/**
 * Create a subscription for recurring payments (e.g. service plans).
 */
export async function createSubscription(params: {
  customer:   string;
  items:      Array<{ price: string }>;
  metadata?:  Record<string, string>;
}): Promise<StripeSubscription> {
  return stripeFetch<StripeSubscription>('/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode(params),
  });
}

// ─── Stripe Terminal ──────────────────────────────────────────────────────────

/**
 * Create a connection token for the Stripe Terminal SDK.
 * The SDK on the point-of-sale device calls this to authenticate.
 */
export async function createTerminalConnectionToken(): Promise<{ secret: string }> {
  return stripeFetch<{ secret: string }>('/terminal/connection_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: LOCATION_ID ? encode({ location: LOCATION_ID }) : '',
  });
}

/**
 * List terminal readers registered under the account.
 */
export async function listTerminalReaders(): Promise<{
  data: Array<{ id: string; label: string; status: string; location: string }>;
}> {
  const qs = LOCATION_ID ? `?location=${LOCATION_ID}` : '';
  return stripeFetch(`/terminal/readers${qs}`);
}

/**
 * Process a terminal payment on a specific reader.
 */
export async function processTerminalPayment(params: {
  reader:           string;
  payment_intent:   string;
}): Promise<Record<string, unknown>> {
  return stripeFetch(`/terminal/readers/${params.reader}/process_payment_intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode({ payment_intent: params.payment_intent }),
  });
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

/**
 * Verify and parse an incoming Stripe webhook event.
 * Call this in your POST /api/stripe/webhook handler.
 */
export function constructWebhookEvent(
  payload:   string,
  signature: string,
): StripeWebhookEvent {
  // Stripe uses HMAC-SHA256 with a timestamp to prevent replay attacks
  const [tPart, v1Part] = signature.split(',');
  const t  = tPart.split('=')[1];
  const v1 = v1Part.split('=')[1];

  const { createHmac } = require('crypto') as typeof import('crypto');
  const expected = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${t}.${payload}`)
    .digest('hex');

  if (expected !== v1) throw new Error('Stripe webhook signature verification failed');

  return JSON.parse(payload) as StripeWebhookEvent;
}
