import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

/**
 * POST /api/leads/[id]/cancel
 *
 * Records a deal cancellation and optionally refunds the customer.
 * - Inserts a row into `cancellations`
 * - Moves the lead stage to 'closed' with status 'lost'
 * - Cancels any pending invoice (status → 'cancelled')
 * - Optionally returns the inventory item to stock (+1)
 *
 * Body: {
 *   dealershipId:    string
 *   reason:          'changed_mind' | 'financial' | 'found_elsewhere' | 'financing_denied' | 'other'
 *   reasonDetail?:   string
 *   refundAmount:    number         (0 = no refund)
 *   refundBank?:     string
 *   refundClearing?: string
 *   refundAccount?:  string
 *   refundReference?:string
 *   returnToStock:   boolean
 *   notes?:          string
 *   cancelledBy?:    string
 *   agreementNumber?:string
 *   customerName?:   string
 *   vehicle?:        string
 *   inventoryItemId?:string        (id of motorcycle/part to return to stock)
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await params;

  try {
    const body = await req.json() as {
      dealershipId:     string;
      reason:           string;
      reasonDetail?:    string;
      refundAmount:     number;
      refundBank?:      string;
      refundClearing?:  string;
      refundAccount?:   string;
      refundReference?: string;
      returnToStock:    boolean;
      notes?:           string;
      cancelledBy?:     string;
      agreementNumber?: string;
      customerName?:    string;
      vehicle?:         string;
      inventoryItemId?: string;
    };

    const supabase = getSupabaseAdmin();

    // 1. Insert cancellation record
    const { data: cancellation, error: cancelErr } = await supabase
      .from('cancellations')
      .insert({
        lead_id:          leadId,
        dealership_id:    body.dealershipId,
        agreement_number: body.agreementNumber ?? null,
        customer_name:    body.customerName    ?? null,
        vehicle:          body.vehicle         ?? null,
        reason:           body.reason,
        reason_detail:    body.reasonDetail    ?? null,
        refund_amount:    body.refundAmount ?? 0,
        refund_bank:      body.refundBank       ?? null,
        refund_clearing:  body.refundClearing   ?? null,
        refund_account:   body.refundAccount    ?? null,
        refund_reference: body.refundReference  ?? null,
        refund_status:    body.refundAmount > 0 ? 'pending' : 'confirmed',
        return_to_stock:  body.returnToStock,
        notes:            body.notes            ?? null,
        cancelled_by:     body.cancelledBy      ?? null,
        status:           'open',
      })
      .select()
      .single();

    if (cancelErr) {
      return NextResponse.json({ error: cancelErr.message }, { status: 500 });
    }

    // 2. Move lead to closed/lost
    await supabase
      .from('custom_leads')
      .update({
        stage:      'closed',
        status:     'cold',
        lost_reason: `Annullerad: ${body.reason}${body.reasonDetail ? ' — ' + body.reasonDetail : ''}`,
        closed_at:  new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('dealership_id', body.dealershipId);

    // 3. Cancel any pending invoices for this lead
    await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('lead_id', leadId)
      .eq('dealership_id', body.dealershipId)
      .in('status', ['pending', 'draft']);

    // 4. Return item to stock if requested
    if (body.returnToStock && body.inventoryItemId) {
      const itemId = body.inventoryItemId;
      const table  = itemId.startsWith('MC-') ? 'motorcycles'
                   : itemId.startsWith('SP-') ? 'spare_parts'
                   : 'accessories';

      // Increment stock by 1 using raw SQL via rpc or read-then-write
      const { data: current } = await supabase
        .from(table)
        .select('stock')
        .eq('id', itemId)
        .eq('dealership_id', body.dealershipId)
        .maybeSingle();

      if (current) {
        await supabase
          .from(table)
          .update({ stock: (current.stock ?? 0) + 1 })
          .eq('id', itemId)
          .eq('dealership_id', body.dealershipId);
      }
    }

    notify({
      dealershipId: body.dealershipId,
      type:    'agreement',
      title:   'Affär annullerad',
      message: `${body.customerName ?? 'Kund'} — ${body.vehicle ?? ''} — ${body.reason}${body.reasonDetail ? ': ' + body.reasonDetail : ''}`,
      href:    `/sales/leads/${leadId}`,
    });

    return NextResponse.json({ cancellation });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[leads/cancel]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
