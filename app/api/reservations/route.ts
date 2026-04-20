// GET  /api/reservations?dealershipId=&leadId=&status=
// POST /api/reservations

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  try {
    const sp           = req.nextUrl.searchParams;
    const dealershipId = sp.get('dealershipId');
    const leadId       = sp.get('leadId');
    const status       = sp.get('status');

    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb()
      .from('reservations')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false });

    if (leadId) q = q.eq('lead_id', leadId);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reservations: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { dealershipId, leadId, ...fields } = body;

    if (!dealershipId || !leadId)
      return NextResponse.json({ error: 'Missing dealershipId or leadId' }, { status: 400 });

    const row = {
      dealership_id:   dealershipId,
      lead_id:         leadId,
      customer_id:     fields.customerId    ?? null,
      vehicle_name:    fields.vehicleName   ?? '',
      vin:             fields.vin           ?? '',
      stock_number:    fields.stockNumber   ?? '',
      deposit_amount:  fields.depositAmount ?? 0,
      deposit_paid:    fields.depositPaid   ?? false,
      deposit_paid_at: fields.depositPaidAt ?? null,
      payment_method:  fields.paymentMethod ?? '',
      payment_ref:     fields.paymentRef    ?? '',
      reserved_until:  fields.reservedUntil ?? null,
      status:          fields.status        ?? 'active',
      reserved_by:     fields.reservedBy    ?? '',
      customer_name:   fields.customerName  ?? '',
      customer_email:  fields.customerEmail ?? '',
      customer_phone:  fields.customerPhone ?? '',
      notes:           fields.notes         ?? '',
    };

    const { data, error } = await sb()
      .from('reservations')
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reservation: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
