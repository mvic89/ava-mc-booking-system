// POST /api/billing/cancel
// Sets cancel_at_period_end = true on the active subscription.
// Body: { dealershipId }

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
  const { dealershipId } = await req.json() as { dealershipId?: string };
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
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
    const subs = await stripeGet<{ data: Array<{ id: string }> }>(
      `/subscriptions?customer=${customerId}&status=active&limit=1`,
    );
    const sub = subs.data[0];
    if (!sub) return NextResponse.json({ error: 'No active subscription' }, { status: 400 });

    await stripe(`/subscriptions/${sub.id}`, new URLSearchParams({
      cancel_at_period_end: 'true',
    }).toString());

    // Sync cancellation flag to Supabase
    sb.from('dealerships').update({ stripe_status: 'canceling' }).eq('id', dealershipId).then(() => {});

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
