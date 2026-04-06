// POST /api/billing/portal
// Creates a Stripe Billing Portal session for card/subscription management.
// Body: { dealershipId, returnUrl }

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

export async function POST(req: NextRequest) {
  const { dealershipId, returnUrl } = await req.json() as { dealershipId?: string; returnUrl?: string };
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
  if (!SK) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const sb = getSupabaseAdmin();
  const { data: dealer } = await sb
    .from('dealerships')
    .select('stripe_customer_id')
    .eq('id', dealershipId)
    .maybeSingle();

  const customerId = (dealer as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: 'No Stripe customer — subscribe first' }, { status: 400 });

  try {
    const session = await stripe<{ url: string }>(
      '/billing_portal/sessions',
      new URLSearchParams({
        customer:   customerId,
        return_url: returnUrl ?? '',
      }).toString(),
    );
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
