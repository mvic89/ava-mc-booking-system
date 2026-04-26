import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe/client';
import { insertWebhookEvent } from '@/lib/webhookStore';
import { notify } from '@/lib/notify';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/stripe/webhook — Stripe event webhook
 * Requires raw body — Next.js must NOT parse it.
 * Add to next.config.ts: api: { bodyParser: false } for this route (or use rawBody approach).
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature') ?? '';

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: 'Could not read body' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = constructWebhookEvent(body, sig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Stripe webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[Stripe webhook] ${event.type} — id: ${event.id}`);

  // Persist to Supabase so Realtime can push updates to the browser
  await insertWebhookEvent('stripe', event.type, event.data.object as object);

  const obj = event.data.object as Record<string, any>;

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      const meta   = (intent.metadata ?? {}) as Record<string, string>;
      const dealershipId = meta.dealershipId;
      const leadId       = meta.leadId;
      if (dealershipId) {
        // Prefer metadata, but fall back to lead lookup if only leadId is stored
        let leadName = meta.customerName ?? '';
        let bike     = meta.vehicle ?? '';
        const amount = typeof intent.amount === 'number'
          ? `${(intent.amount / 100).toLocaleString('sv-SE')} kr`
          : '';
        if (leadId && !leadName) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: lead } = await (getSupabaseAdmin() as any)
            .from('leads').select('name,bike').eq('id', Number(leadId)).maybeSingle();
          if (lead) { leadName = lead.name; bike = lead.bike; }
        }
        notify({
          dealershipId,
          type:    'payment',
          title:   'Kortbetalning mottagen ✓',
          message: `${leadName ?? 'Kund'}${bike ? ` — ${bike}` : ''}${amount ? ` · ${amount}` : ''} via Stripe`,
          href:    leadId ? `/sales/leads/${leadId}/payment` : undefined,
        });
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      const meta   = (intent.metadata ?? {}) as Record<string, string>;
      const dealershipId = meta.dealershipId;
      const leadId       = meta.leadId;
      if (dealershipId) {
        notify({
          dealershipId,
          type:    'payment',
          title:   'Kortbetalning misslyckades',
          message: `Betalning nekad${meta.customerName ? ` — ${meta.customerName}` : ''}`,
          href:    leadId ? `/sales/leads/${leadId}/payment` : undefined,
        });
      }
      break;
    }
    case 'charge.refunded':
      // TODO: mark order as refunded
      break;
    case 'charge.dispute.created':
      console.warn(`[Stripe] Dispute created — ${obj.id}`);
      break;
  }

  return NextResponse.json({ received: true });
}
