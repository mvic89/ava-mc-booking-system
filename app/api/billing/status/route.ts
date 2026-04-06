// GET /api/billing/status?dealershipId=…
// Returns live subscription + payment method data from Stripe.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BASE = 'https://api.stripe.com/v1';
const SK   = process.env.STRIPE_SECRET_KEY ?? '';

async function stripe<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SK}`,
      'Stripe-Version': '2024-06-20',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message: string } };
    throw new Error(e.error?.message ?? `Stripe ${res.status}`);
  }
  return res.json() as T;
}

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
  if (!SK) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const sb = getSupabaseAdmin();
  const { data: dealer, error } = await sb
    .from('dealerships')
    .select('stripe_customer_id, stripe_subscription_id, stripe_plan, stripe_status, stripe_period_end, email, name')
    .eq('id', dealershipId)
    .maybeSingle();

  if (error || !dealer) return NextResponse.json({ error: 'Dealership not found' }, { status: 404 });

  const customerId = (dealer as { stripe_customer_id: string | null }).stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ configured: false });
  }

  try {
    // Fetch active subscriptions for this customer (expand price + payment method)
    const subList = await stripe<{ data: StripeSubscription[] }>(
      `/subscriptions?customer=${customerId}&status=all&limit=5&expand[]=data.default_payment_method&expand[]=data.items.data.price`,
    );

    const sub = subList.data.find(s => ['active','trialing','past_due'].includes(s.status))
             ?? subList.data[0]
             ?? null;

    // Fetch payment methods
    let card: CardInfo | null = null;
    if (sub?.default_payment_method && typeof sub.default_payment_method === 'object') {
      const pm = sub.default_payment_method as StripePaymentMethod;
      if (pm.card) {
        card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
      }
    } else {
      try {
        const pmList = await stripe<{ data: StripePaymentMethod[] }>(
          `/payment_methods?customer=${customerId}&type=card&limit=1`,
        );
        const pm = pmList.data[0];
        if (pm?.card) {
          card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
        }
      } catch {}
    }

    const priceId = (() => { const p = sub?.items.data[0]?.price; return typeof p === 'string' ? p : (p?.id ?? null); })();

    // Sync Stripe subscription state to Supabase (fire-and-forget cache)
    if (sub) {
      const BASIC    = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY    ?? '';
      const PRO      = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY      ?? '';
      const planName = priceId === BASIC ? 'basic' : priceId === PRO ? 'pro' : 'standard';
      sb.from('dealerships').update({
        stripe_subscription_id: sub.id,
        stripe_plan:            planName,
        stripe_status:          sub.status,
        stripe_period_end:      new Date(sub.current_period_end * 1000).toISOString(),
      }).eq('id', dealershipId).then(() => {});
    }

    return NextResponse.json({
      configured:   true,
      customerId,
      subscription: sub
        ? {
            id:         sub.id,
            status:     sub.status,
            priceId,
            amount:     (() => { const p = sub.items.data[0]?.price; return typeof p === 'string' ? null : (p?.unit_amount ?? null); })(),
            currency:   (() => { const p = sub.items.data[0]?.price; return typeof p === 'string' ? 'sek' : (p?.currency ?? 'sek'); })(),
            interval:   (() => { const p = sub.items.data[0]?.price; return typeof p === 'string' ? 'month' : (p?.recurring?.interval ?? 'month'); })(),
            periodEnd:  sub.current_period_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          }
        : null,
      card,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}

// ─── Stripe types ─────────────────────────────────────────────────────────────

interface StripeSubscription {
  id:                   string;
  status:               string;
  current_period_end:   number;
  cancel_at_period_end: boolean;
  default_payment_method: string | StripePaymentMethod | null;
  items: { data: Array<{ price: { id: string; unit_amount: number; currency: string; recurring?: { interval: string } } }> };
}

interface StripePaymentMethod {
  id:   string;
  card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
}

interface CardInfo {
  brand:    string;
  last4:    string;
  expMonth: number;
  expYear:  number;
}
