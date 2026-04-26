import { NextRequest, NextResponse } from 'next/server';
import { insertWebhookEvent } from '@/lib/webhookStore';
import { notify } from '@/lib/notify';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/adyen/webhook — Adyen event notifications
 * In production: validate HMAC signature using ADYEN_WEBHOOK_HMAC_KEY
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const notifications = body?.notificationItems ?? [];

    for (const item of notifications) {
      const n = item?.NotificationRequestItem;
      if (!n) continue;

      const { eventCode, success, pspReference, merchantReference } = n;
      console.log(`[Adyen webhook] ${eventCode} — ref: ${pspReference} order: ${merchantReference} success: ${success}`);

      // Persist to Supabase so Realtime can push updates to the browser
      await insertWebhookEvent('adyen', eventCode, n);

      // Look up lead for notification routing
      let dealershipId: string | null = null;
      let customerName = 'Kund';
      let vehicleName  = 'Fordon';
      if (merchantReference) {
        const sb = getSupabaseAdmin();
        const { data: lead } = await sb
          .from('custom_leads')
          .select('dealership_id, first_name, last_name, vehicle')
          .eq('id', merchantReference)
          .single();
        if (lead) {
          dealershipId = lead.dealership_id;
          customerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Kund';
          vehicleName  = lead.vehicle || 'Fordon';
        }
      }

      switch (eventCode) {
        case 'AUTHORISATION':
          if (success === 'true' && dealershipId) {
            await notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-betalning auktoriserad ✓',
              message: `${customerName} · ${vehicleName} · Auktorisering godkänd`,
              href:    merchantReference ? `/sales/leads/${merchantReference}` : undefined,
            });
          }
          break;
        case 'CAPTURE':
          if (success === 'true' && dealershipId) {
            await notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-betalning mottagen ✓',
              message: `${customerName} · ${vehicleName} · Betalning genomförd`,
              href:    merchantReference ? `/sales/leads/${merchantReference}` : undefined,
            });
          }
          break;
        case 'REFUND':
          if (success === 'true' && dealershipId) {
            await notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-återbetalning genomförd',
              message: `${customerName} · ${vehicleName} · Återbetalning klar`,
              href:    merchantReference ? `/sales/leads/${merchantReference}` : undefined,
            });
          }
          break;
        case 'CANCELLATION':
          if (dealershipId) {
            await notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-betalning avbruten',
              message: `${customerName} · ${vehicleName} · Betalning avbruten`,
              href:    merchantReference ? `/sales/leads/${merchantReference}` : undefined,
            });
          }
          break;
        case 'CHARGEBACK':
          console.warn(`[Adyen] Chargeback received — ${pspReference}`);
          if (dealershipId) {
            await notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-chargeback inkommen',
              message: `${customerName} · ${vehicleName} · Ref: ${pspReference}`,
              href:    merchantReference ? `/sales/leads/${merchantReference}` : undefined,
            });
          }
          break;
      }
    }

    // Adyen expects "[accepted]" as response body
    return new NextResponse('[accepted]', { status: 200 });
  } catch (error: any) {
    console.error('[Adyen webhook error]', error.message);
    return new NextResponse('[accepted]', { status: 200 }); // always 200
  }
}
