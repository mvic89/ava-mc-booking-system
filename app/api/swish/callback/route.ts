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
      // Look up the lead to get dealership_id for notification routing
      const sb = getSupabaseAdmin();
      const { data: lead } = await sb
        .from('custom_leads')
        .select('dealership_id, first_name, last_name, vehicle')
        .eq('id', paymentReference)
        .single();
      if (lead?.dealership_id) {
        const customerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Kund';
        await notify({
          dealershipId: lead.dealership_id,
          type:         'payment',
          title:        'Swish-betalning mottagen ✓',
          message:      `${customerName} · ${lead.vehicle ?? 'Fordon'} · Betalning genomförd`,
          href:         `/sales/leads/${paymentReference}`,
        });
      }
    } else if (status === 'DECLINED' || status === 'ERROR') {
      console.warn(`[Swish] Payment ${id} failed — ${errorCode}: ${errorMessage}`);
      const sb = getSupabaseAdmin();
      const { data: lead } = await sb
        .from('custom_leads')
        .select('dealership_id, first_name, last_name')
        .eq('id', paymentReference)
        .single();
      if (lead?.dealership_id) {
        const customerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Kund';
        await notify({
          dealershipId: lead.dealership_id,
          type:         'payment',
          title:        'Swish-betalning misslyckades',
          message:      `${customerName} · ${errorCode ?? status}: ${errorMessage ?? ''}`,
          href:         `/sales/leads/${paymentReference}`,
        });
      }
    }

    // Swish expects HTTP 200 (no body required)
    return new NextResponse(null, { status: 200 });
  } catch (error: any) {
    console.error('[Swish callback error]', error.message);
    return new NextResponse(null, { status: 200 }); // always 200 to Swish
  }
}
