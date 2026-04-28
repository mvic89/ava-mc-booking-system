// PUT  /api/reservations/[id]
// DELETE /api/reservations/[id]

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await req.json() as Record<string, unknown>;

    const map: Record<string, string> = {
      vehicleName: 'vehicle_name', vin: 'vin', stockNumber: 'stock_number',
      depositAmount: 'deposit_amount', depositPaid: 'deposit_paid',
      depositPaidAt: 'deposit_paid_at', paymentMethod: 'payment_method',
      paymentRef: 'payment_ref', reservedUntil: 'reserved_until',
      status: 'status', notes: 'notes',
      customerName: 'customer_name', customerEmail: 'customer_email', customerPhone: 'customer_phone',
    };

    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (map[k]) update[map[k]] = v;
    }

    const { data, error } = await sb()
      .from('reservations')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reservation: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await sb().from('reservations').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
