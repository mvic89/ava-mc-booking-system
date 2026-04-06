// POST /api/billing/change-plan
// Switches a subscription to a different Stripe Price (plan upgrade/downgrade).
// Body: { dealershipId, priceId }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BASE = 'https://api.stripe.com/v1';
const SK   = process.env.STRIPE_SECRET_KEY ?? '';

async function stripe<T>(path: string, body: string): Promise<T> {
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
  const { dealershipId, priceId } = await req.json() as { dealershipId?: string; priceId?: string };
  if (!dealershipId || !priceId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
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
    // Fetch ALL non-canceled subscriptions — trialing counts too
    const subs = await stripeGet<{
      data: Array<{
        id:     string;
        status: string;
        items:  { data: Array<{ id: string; price: { id: string } }> };
      }>;
    }>(
      `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10&expand[]=data.items.data.price`,
    );
    // Pick active first, then trialing, then past_due, then any non-canceled
    const PRIORITY = ['active','trialing','past_due','incomplete','unpaid'];
    const sub = PRIORITY.reduce<typeof subs.data[0] | null>((best, status) => {
      if (best) return best;
      return subs.data.find(s => s.status === status) ?? null;
    }, null) ?? subs.data.find(s => s.status !== 'canceled') ?? null;
    if (!sub) return NextResponse.json({ error: 'No active subscription' }, { status: 400 });

    const item = sub.items.data[0];
    if (!item) return NextResponse.json({ error: 'Subscription has no items' }, { status: 400 });

    // Normalise: price can be a string or object depending on Stripe expansion
    let currentPriceId = typeof item.price === 'string' ? item.price : item.price?.id;

    // If expansion didn't work (price came back as object without id, or undefined),
    // fetch the subscription item directly to get a reliable price id
    if (!currentPriceId) {
      const si = await stripeGet<{ price: { id: string } | string }>(
        `/subscription_items/${item.id}`,
      );
      currentPriceId = typeof si.price === 'string' ? si.price : si.price?.id;
    }

    // Already on this price — nothing to do
    if (currentPriceId === priceId) return NextResponse.json({ ok: true });

    // Update the subscription item's price directly (never adds a new item)
    try {
      await stripe(`/subscription_items/${item.id}`, new URLSearchParams({
        price:              priceId,
        proration_behavior: 'create_prorations',
      }).toString());
    } catch (stripeErr: unknown) {
      const msg = stripeErr instanceof Error ? stripeErr.message : '';
      // If Stripe says the subscription is already on this price, treat as success
      if (msg.includes('already using that Price') || msg.includes('already on this Price')) {
        return NextResponse.json({ ok: true });
      }
      throw stripeErr;
    }

    // Sync updated plan to Supabase
    const BASIC    = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY    ?? '';
    const PRO      = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY      ?? '';
    const planName = priceId === BASIC ? 'basic' : priceId === PRO ? 'pro' : 'standard';
    sb.from('dealerships').update({
      stripe_subscription_id: sub.id,
      stripe_plan:            planName,
      stripe_status:          'active',
    }).eq('id', dealershipId).then(() => {});

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
