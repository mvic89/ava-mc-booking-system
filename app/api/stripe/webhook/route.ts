import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe/client';
import { insertWebhookEvent } from '@/lib/webhookStore';

/**
 * POST /api/stripe/webhook — Stripe event webhook
 * Requires raw body — Next.js must NOT parse it.
 * Add to next.config.ts: api: { bodyParser: false } for this route (or use rawBody approach).
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature') ?? '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: 'Could not read body' }, { status: 400 });
  }

  let event: any;
  try {
    event = constructWebhookEvent(body, sig, secret);
  } catch (err: any) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[Stripe webhook] ${event.type} — id: ${event.id}`);

  // Persist to Supabase so Realtime can push updates to the browser
  await insertWebhookEvent('stripe', event.type, event.data.object as object);

  switch (event.type) {
    case 'payment_intent.succeeded':
      // TODO: mark order as paid
      break;
    case 'payment_intent.payment_failed':
      // TODO: handle failure
      break;
    case 'charge.refunded':
      // TODO: mark order as refunded
      break;
    case 'charge.dispute.created':
      console.warn(`[Stripe] Dispute created — ${event.data.object.id}`);
      break;
  }

  return NextResponse.json({ received: true });
}
