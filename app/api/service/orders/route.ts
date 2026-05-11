import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/orders?dealershipId=…[&status=…]
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ orders: [] });

  const status = req.nextUrl.searchParams.get('status');

  let query = sb()
    .from('work_orders')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

// POST /api/service/orders — create new work order (or from booking)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dealershipId, bookingId, customerId, customerName, customerPhone, customerEmail,
      vehicleId, vehicleName, plate, vin,
      description, priority, assignedTech, mileage, laborRate,
    } = body;

    if (!dealershipId) {
      return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });
    }

    // Resolve customer email: use provided value, or look up from customers table
    let resolvedEmail: string | null = customerEmail ?? null;
    if (!resolvedEmail && customerId) {
      const { data: cust } = await sb()
        .from('customers').select('email').eq('id', customerId).maybeSingle();
      resolvedEmail = cust?.email ?? null;
    }

    const { data, error } = await sb()
      .from('work_orders')
      .insert({
        dealership_id:  String(dealershipId),
        booking_id:     bookingId ?? null,
        customer_id:    customerId ?? null,
        customer_name:  customerName ?? '',
        customer_phone: customerPhone ?? '',
        customer_email: resolvedEmail,
        vehicle_id:     vehicleId ?? null,
        vehicle_name:   vehicleName ?? '',
        plate:          plate ?? '',
        vin:            vin ?? '',
        description:    description ?? '',
        priority:       priority ?? 'normal',
        assigned_tech:  assignedTech ?? '',
        mileage:        mileage ?? null,
        labor_rate:     laborRate ?? 850,
        status:         'created',
      })
      .select()
      .single();

    if (error) {
      console.error('[work_orders] insert error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, { status: 500 });
    }

    // If created from a booking, link it back
    if (bookingId) {
      await sb()
        .from('service_bookings')
        .update({ work_order_id: data.id, status: 'checked_in', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('dealership_id', dealershipId);
    }

    notify({
      dealershipId,
      type:    'system',
      title:   'Ny arbetsorder skapad',
      message: `AO-${data.id} · ${customerName || 'Kund'} · ${vehicleName || 'Fordon'}`,
      href:    `/service/orders/${data.id}`,
    });

    return NextResponse.json({ order: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
