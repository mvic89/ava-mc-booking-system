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
      const meta       = (obj.metadata ?? {}) as Record<string, string>;
      const leadId     = meta.leadId;
      const dealershipId = meta.dealershipId;
      const customerName = meta.customerName || 'Kund';
      const vehicle      = meta.vehicle      || 'Fordon';
      // Fallback: look up lead if metadata not present
      if (dealershipId) {
        await notify({
          dealershipId,
          type:    'payment',
          title:   'Stripe-betalning mottagen ✓',
          message: `${customerName} · ${vehicle} · Betalning genomförd`,
          href:    leadId ? `/sales/leads/${leadId}` : undefined,
        });
      } else if (leadId) {
        const sb = getSupabaseAdmin();
        const { data: lead } = await sb.from('custom_leads').select('dealership_id, first_name, last_name, vehicle').eq('id', leadId).single();
        if (lead?.dealership_id) {
          const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || customerName;
          await notify({ dealershipId: lead.dealership_id, type: 'payment', title: 'Stripe-betalning mottagen ✓', message: `${name} · ${lead.vehicle ?? vehicle} · Betalning genomförd`, href: `/sales/leads/${leadId}` });
        }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const meta         = (obj.metadata ?? {}) as Record<string, string>;
      const leadId       = meta.leadId;
      const dealershipId = meta.dealershipId;
      const customerName = meta.customerName || 'Kund';
      if (dealershipId) {
        await notify({
          dealershipId,
          type:    'payment',
          title:   'Stripe-betalning misslyckades',
          message: `${customerName} · ${obj.last_payment_error?.message ?? 'Betalning nekades'}`,
          href:    leadId ? `/sales/leads/${leadId}` : undefined,
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
