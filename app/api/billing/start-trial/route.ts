// POST /api/billing/start-trial
// Called at signup completion — creates a Stripe customer + 14-day trial subscription
// and syncs the result back to the dealerships row.
// Body: { dealershipId, email, name, planId }
// planId: 'basic' | 'standard' | 'pro' (maps to Stripe price env vars)

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BASE = 'https://api.stripe.com/v1';
const SK   = process.env.STRIPE_SECRET_KEY ?? '';

const PRICE_MAP: Record<string, string> = {
  basic:    process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY    ?? '',
  standard: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_MONTHLY ?? '',
  pro:      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY      ?? '',
  // Signup plan name aliases
  starter:      process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY    ?? '',
  professional: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_MONTHLY ?? '',
  enterprise:   process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY      ?? '',
};

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
  const { dealershipId, email, name, planId } = await req.json() as {
    dealershipId?: string;
    email?:        string;
    name?:         string;
    planId?:       string;
  };

  if (!dealershipId || !email) {
    return NextResponse.json({ error: 'Missing dealershipId or email' }, { status: 400 });
  }

  // Stripe not configured — skip silently (trial still works, billing page will show unconfigured)
  if (!SK) return NextResponse.json({ ok: true, skipped: true });

  const priceId = PRICE_MAP[planId ?? 'standard'] ?? PRICE_MAP['standard'];
  if (!priceId) return NextResponse.json({ ok: true, skipped: true, reason: 'No price configured' });

  const sb = getSupabaseAdmin();

  try {
    // Check if a Stripe customer already exists for this dealership
    const { data: dealer } = await sb
      .from('dealerships')
      .select('stripe_customer_id')
      .eq('id', dealershipId)
      .maybeSingle();

    let customerId = (dealer as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? '';

    // Create customer if not yet linked
    if (!customerId) {
      const customer = await stripePost<{ id: string }>('/customers', {
        email,
        name:                      name ?? '',
        'metadata[dealershipId]':  dealershipId,
      });
      customerId = customer.id;
    }

    // Create trial subscription (14 days, no card required)
    const sub = await stripePost<{
      id:                  string;
      status:              string;
      current_period_end:  number;
      trial_end:           number | null;
    }>('/subscriptions', {
      customer:              customerId,
      'items[0][price]':     priceId,
      trial_period_days:     14,
      'payment_settings[save_default_payment_method]': 'on_subscription',
      // Don't require payment method for trial
    });

    // Map planId to normalized name
    const BASIC = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY ?? '';
    const PRO   = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY   ?? '';
    const planName = priceId === BASIC ? 'basic' : priceId === PRO ? 'pro' : 'standard';

    // Sync to Supabase dealerships row
    await sb.from('dealerships').update({
      stripe_customer_id:     customerId,
      stripe_subscription_id: sub.id,
      stripe_plan:            planName,
      stripe_status:          sub.status,
      stripe_period_end:      new Date(sub.current_period_end * 1000).toISOString(),
    }).eq('id', dealershipId);

    return NextResponse.json({ ok: true, customerId, subscriptionId: sub.id, status: sub.status });
  } catch (err: unknown) {
    // Non-fatal — log but don't fail signup
    console.error('[billing/start-trial]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, skipped: true, error: err instanceof Error ? err.message : 'Stripe error' });
  }
}
