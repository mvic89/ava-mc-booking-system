// POST /api/billing/update-payment-method
// After SetupIntent confirms on the client, sets the new payment method as
// the customer's default and attaches it to their active subscription.
// Body: { dealershipId, paymentMethodId }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BASE = 'https://api.stripe.com/v1';
const SK   = process.env.STRIPE_SECRET_KEY ?? '';

async function stripePost<T>(path: string, body: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SK}`,
      'Stripe-Version': '2024-06-20',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message: string } };
    throw new Error(e.error?.message ?? `Stripe ${res.status}`);
  }
  return res.json() as T;
}

async function stripeGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${SK}`, 'Stripe-Version': '2024-06-20' },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message: string } };
    throw new Error(e.error?.message ?? `Stripe ${res.status}`);
  }
  return res.json() as T;
}

export async function POST(req: NextRequest) {
  const { dealershipId, paymentMethodId } = await req.json() as {
    dealershipId?:    string;
    paymentMethodId?: string;
  };
  if (!dealershipId || !paymentMethodId)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (!SK) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const sb = getSupabaseAdmin();
  const { data: dealer } = await sb
    .from('dealerships')
    .select('stripe_customer_id')
    .eq('id', dealershipId)
    .maybeSingle();

  const customerId = (dealer as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: 'No Stripe customer' }, { status: 400 });

  try {
    // 1. Set as default payment method on the customer
    await stripePost(`/customers/${customerId}`, new URLSearchParams({
      'invoice_settings[default_payment_method]': paymentMethodId,
    }).toString());

    // 2. Also update the active subscription so future renewals use this card
    const subs = await stripeGet<{ data: Array<{ id: string }> }>(
      `/subscriptions?customer=${customerId}&status=active&limit=1`,
    );
    const sub = subs.data[0];
    if (sub) {
      await stripePost(`/subscriptions/${sub.id}`, new URLSearchParams({
        default_payment_method: paymentMethodId,
      }).toString());
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
