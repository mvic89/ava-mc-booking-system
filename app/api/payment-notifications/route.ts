import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET  /api/payment-notifications?dealershipId=X&unreadOnly=true
 *      Returns payment notifications for a dealership.
 *
 * POST /api/payment-notifications
 *      Body: { dealershipId, invoiceId, type, amount, reference, customerName, vehicle }
 *      Manually inserts a "manual_confirm" notification (e.g. dealer clicks "Mark as paid").
 *
 * PATCH /api/payment-notifications
 *      Body: { ids: string[], dealershipId: string }
 *      Marks notifications as read.
 */

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  const unreadOnly   = req.nextUrl.searchParams.get('unreadOnly') === 'true';

  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('payment_notifications')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('read', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealershipId:   string;
      invoiceId?:     string;
      leadId?:        string;
      type?:          string;
      amount?:        number;
      reference?:     string;
      customerName?:  string;
      vehicle?:       string;
    };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('payment_notifications')
      .insert({
        dealership_id:     body.dealershipId,
        invoice_id:        body.invoiceId     ?? null,
        lead_id:           body.leadId        ?? null,
        notification_type: body.type          ?? 'manual_confirm',
        amount:            body.amount        ?? null,
        currency:          'SEK',
        reference:         body.reference     ?? null,
        customer_name:     body.customerName  ?? null,
        vehicle:           body.vehicle       ?? null,
        read:              false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { ids, dealershipId } = await req.json() as { ids: string[]; dealershipId: string };
    if (!ids?.length || !dealershipId) return NextResponse.json({ error: 'Missing ids or dealershipId' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('payment_notifications')
      .update({ read: true })
      .in('id', ids)
      .eq('dealership_id', dealershipId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
