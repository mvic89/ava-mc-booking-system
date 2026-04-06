// POST /api/billing/webhook
// Stripe webhook handler — keeps dealerships table in sync with Stripe events.
// Configure in Stripe Dashboard → Developers → Webhooks → Add endpoint.
// Events to subscribe: customer.subscription.updated, customer.subscription.deleted,
//                      invoice.payment_succeeded, invoice.payment_failed

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const SK              = process.env.STRIPE_SECRET_KEY ?? '';
const WEBHOOK_SECRET  = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const BASIC           = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY    ?? '';
const PRO             = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY      ?? '';

function planFromPriceId(priceId: string | null): string {
  if (!priceId) return 'standard';
  if (priceId === BASIC) return 'basic';
  if (priceId === PRO)   return 'pro';
  return 'standard';
}

async function verifyStripeSignature(body: string, sig: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const parts   = sig.split(',');
    const tPart   = parts.find(p => p.startsWith('t='));
    const v1Part  = parts.find(p => p.startsWith('v1='));
    if (!tPart || !v1Part) return false;

    const timestamp  = tPart.slice(2);
    const signature  = v1Part.slice(3);
    const payload    = `${timestamp}.${body}`;
    const key        = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed     = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hex        = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === signature;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  // Verify signature if secret is configured
  if (WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(body, sig, WEBHOOK_SECRET);
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sb  = getSupabaseAdmin();
  const obj = event.data.object as Record<string, unknown>;

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customerId = obj.customer as string;
      const status     = obj.status as string;
      const cancelAt   = obj.cancel_at_period_end as boolean;
      const periodEnd  = obj.current_period_end as number;
      const subId      = obj.id as string;
      const items      = obj.items as { data: Array<{ price: { id: string } }> };
      const priceId    = items?.data?.[0]?.price?.id ?? null;

      const stripeStatus = event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : cancelAt ? 'canceling' : status;

      await sb.from('dealerships').update({
        stripe_subscription_id: subId,
        stripe_plan:            planFromPriceId(priceId),
        stripe_status:          stripeStatus,
        stripe_period_end:      new Date(periodEnd * 1000).toISOString(),
      }).eq('stripe_customer_id', customerId);
      break;
    }

    case 'invoice.payment_succeeded': {
      const customerId = obj.customer as string;
      const subId      = obj.subscription as string | null;
      if (subId) {
        // Fetch subscription to get latest price
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { Authorization: `Bearer ${SK}`, 'Stripe-Version': '2024-06-20' },
        });
        if (res.ok) {
          const sub = await res.json() as { status: string; current_period_end: number; items: { data: Array<{ price: { id: string } }> } };
          await sb.from('dealerships').update({
            stripe_status:     sub.status,
            stripe_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            stripe_plan:       planFromPriceId(sub.items.data[0]?.price?.id ?? null),
          }).eq('stripe_customer_id', customerId);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const customerId = obj.customer as string;
      await sb.from('dealerships').update({ stripe_status: 'past_due' }).eq('stripe_customer_id', customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
