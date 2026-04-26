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

      // Try to resolve dealershipId + lead info from merchantReference (= leadId)
      const leadId = merchantReference ? Number(merchantReference) : NaN;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leadRow = !isNaN(leadId) ? await (getSupabaseAdmin() as any)
        .from('leads').select('name,bike,value,dealership_id').eq('id', leadId).maybeSingle()
        .then((r: { data: Record<string, unknown> | null }) => r.data) : null;
      const dealershipId: string | undefined = leadRow?.dealership_id as string | undefined;

      switch (eventCode) {
        case 'AUTHORISATION':
          if (success === 'true' && dealershipId) {
            notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-betalning auktoriserad ✓',
              message: `${leadRow?.name ?? 'Kund'}${leadRow?.bike ? ` — ${leadRow.bike}` : ''} · ref: ${pspReference}`,
              href:    leadId ? `/sales/leads/${leadId}/payment` : undefined,
            });
          }
          break;
        case 'CAPTURE':
          if (success === 'true' && dealershipId) {
            notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-betalning genomförd ✓',
              message: `${leadRow?.name ?? 'Kund'}${leadRow?.bike ? ` — ${leadRow.bike}` : ''}${leadRow?.value ? ` · ${leadRow.value}` : ''} via Adyen`,
              href:    leadId ? `/sales/leads/${leadId}/payment` : undefined,
            });
          }
          break;
        case 'REFUND':
          if (success === 'true' && dealershipId) {
            notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-återbetalning genomförd',
              message: `Återbetalning för ${leadRow?.name ?? 'kund'} · ref: ${pspReference}`,
            });
          }
          break;
        case 'CANCELLATION':
          if (dealershipId) {
            notify({
              dealershipId,
              type:    'payment',
              title:   'Adyen-betalning avbruten',
              message: `Betalning avbruten${leadRow?.name ? ` — ${leadRow.name}` : ''} · ref: ${pspReference}`,
              href:    leadId ? `/sales/leads/${leadId}/payment` : undefined,
            });
          }
          break;
        case 'CHARGEBACK':
          console.warn(`[Adyen] Chargeback received — ${pspReference}`);
          if (dealershipId) {
            notify({
              dealershipId,
              type:    'payment',
              title:   '⚠️ Adyen chargeback mottagen',
              message: `Chargeback för ${leadRow?.name ?? 'kund'} · ref: ${pspReference}`,
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
