import { NextRequest, NextResponse } from 'next/server';
import { insertWebhookEvent } from '@/lib/webhookStore';
import { notify } from '@/lib/notify';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/swish/callback
 * Swish pushes payment/refund status updates here.
 * In production: verify the request comes from Swish MSS IP ranges.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Swish callback]', JSON.stringify(body));

    const { id, status, paymentReference, errorCode, errorMessage } = body;

    // Persist to Supabase so Realtime can push updates to the browser
    await insertWebhookEvent('swish', status ?? 'callback', body);

    if (status === 'PAID') {
      console.log(`[Swish] Payment ${id} succeeded — ref: ${paymentReference}`);
      // Look up the lead via paymentReference (= orderId = leadId) to find dealershipId
      if (paymentReference) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lead } = await (getSupabaseAdmin() as any)
          .from('leads')
          .select('name, bike, value, dealership_id')
          .eq('id', Number(paymentReference))
          .maybeSingle();
        if (lead?.dealership_id) {
          notify({
            dealershipId: lead.dealership_id,
            type:         'payment',
            title:        'Swish-betalning mottagen ✓',
            message:      `${lead.name ?? 'Kund'} — ${lead.bike ?? ''} · ${lead.value ?? ''} via Swish`,
            href:         `/sales/leads/${paymentReference}/payment`,
          });
        }
      }
    } else if (status === 'DECLINED' || status === 'ERROR') {
      console.warn(`[Swish] Payment ${id} failed — ${errorCode}: ${errorMessage}`);
      if (paymentReference) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lead } = await (getSupabaseAdmin() as any)
          .from('leads')
          .select('name, dealership_id')
          .eq('id', Number(paymentReference))
          .maybeSingle();
        if (lead?.dealership_id) {
          notify({
            dealershipId: lead.dealership_id,
            type:         'payment',
            title:        'Swish-betalning misslyckades',
            message:      `${lead.name ?? 'Kund'}: ${errorCode ?? status} — ${errorMessage ?? 'Okänt fel'}`,
            href:         `/sales/leads/${paymentReference}/payment`,
          });
        }
      }
    }

    // Swish expects HTTP 200 (no body required)
    return new NextResponse(null, { status: 200 });
  } catch (error: any) {
    console.error('[Swish callback error]', error.message);
    return new NextResponse(null, { status: 200 }); // always 200 to Swish
  }
}
