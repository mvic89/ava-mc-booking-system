// POST /api/billing/checkout
// Creates a Stripe Checkout session for initial subscription.
// Body: { dealershipId, priceId, successUrl, cancelUrl }
// Returns: { url } — redirect user to this URL

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BASE = 'https://api.stripe.com/v1';
const SK   = process.env.STRIPE_SECRET_KEY ?? '';

function encode(obj: Record<string, string | number | boolean | undefined | null>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function stripePost<T>(path: string, params: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SK}`,
      'Stripe-Version': '2024-06-20',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encode(params),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message: string } };
    throw new Error(e.error?.message ?? `Stripe ${res.status}`);
  }
  return res.json() as T;
}

export async function POST(req: NextRequest) {
  const { dealershipId, priceId, successUrl, cancelUrl } = await req.json() as {
    dealershipId?: string;
    priceId?:      string;
    successUrl?:   string;
    cancelUrl?:    string;
  };
  if (!dealershipId || !priceId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (!SK) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const sb = getSupabaseAdmin();
  const { data: dealer } = await sb
    .from('dealerships')
    .select('stripe_customer_id, email, name')
    .eq('id', dealershipId)
    .maybeSingle();

  const d = dealer as { stripe_customer_id: string | null; email: string | null; name: string } | null;

  try {
    let customerId = d?.stripe_customer_id ?? '';

    // Create Stripe customer if not yet linked
    if (!customerId) {
      const customer = await stripePost<{ id: string }>('/customers', {
        email:                     d?.email ?? '',
        name:                      d?.name  ?? '',
        'metadata[dealershipId]':  dealershipId,
      });
      customerId = customer.id;
      await sb.from('dealerships').update({ stripe_customer_id: customerId }).eq('id', dealershipId);
    }

    // Create Checkout session
    const session = await stripePost<{ url: string }>('/checkout/sessions', {
      customer:                                customerId,
      mode:                                    'subscription',
      'line_items[0][price]':                  priceId,
      'line_items[0][quantity]':               1,
      success_url:                             successUrl ?? '',
      cancel_url:                              cancelUrl  ?? '',
      'subscription_data[metadata][dealershipId]': dealershipId,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
