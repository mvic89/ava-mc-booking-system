// POST /api/billing/setup-intent
// Creates a Stripe SetupIntent so the frontend can collect card details inline
// using Stripe Elements without redirecting to the Billing Portal.
// Body: { dealershipId }
// Returns: { clientSecret }

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

export async function POST(req: NextRequest) {
  const { dealershipId } = await req.json() as { dealershipId?: string };
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
  if (!SK) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const sb = getSupabaseAdmin();
  const { data: dealer } = await sb
    .from('dealerships')
    .select('stripe_customer_id, email, name')
    .eq('id', dealershipId)
    .maybeSingle();

  const d = dealer as { stripe_customer_id: string | null; email: string | null; name: string } | null;
  let customerId = d?.stripe_customer_id ?? '';

  // Create Stripe customer if not yet linked
  if (!customerId) {
    const customer = await stripePost<{ id: string }>('/customers', new URLSearchParams({
      email:                      d?.email ?? '',
      name:                       d?.name  ?? '',
      'metadata[dealershipId]':   dealershipId,
    }).toString());
    customerId = customer.id;
    await sb.from('dealerships').update({ stripe_customer_id: customerId }).eq('id', dealershipId);
  }

  try {
    const si = await stripePost<{ client_secret: string }>('/setup_intents', new URLSearchParams({
      customer:                  customerId,
      'payment_method_types[]':  'card',
      usage:                     'off_session',
    }).toString());

    return NextResponse.json({ clientSecret: si.client_secret });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
