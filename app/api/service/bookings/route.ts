import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/bookings?dealershipId=…[&date=YYYY-MM-DD]
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ bookings: [] });

  const date = req.nextUrl.searchParams.get('date');

  let query = sb()
    .from('service_bookings')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('scheduled_at', { ascending: true });

  if (date) {
    const start = `${date}T00:00:00Z`;
    const end   = `${date}T23:59:59Z`;
    query = query.gte('scheduled_at', start).lte('scheduled_at', end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}

// POST /api/service/bookings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dealershipId, customerId, customerName, customerPhone, customerEmail,
      vehicleId, vehicleName, plate, vin,
      serviceType, description, scheduledAt, durationMin, assignedTech, notes,
    } = body;

    if (!dealershipId || !scheduledAt) {
      return NextResponse.json({ error: 'dealershipId and scheduledAt required' }, { status: 400 });
    }

    const { data, error } = await sb()
      .from('service_bookings')
      .insert({
        dealership_id:  dealershipId,
        customer_id:    customerId ?? null,
        customer_name:  customerName ?? '',
        customer_phone: customerPhone ?? '',
        customer_email: customerEmail ?? '',
        vehicle_id:     vehicleId ?? null,
        vehicle_name:   vehicleName ?? '',
        plate:          plate ?? '',
        vin:            vin ?? '',
        service_type:   serviceType ?? 'maintenance',
        description:    description ?? '',
        scheduled_at:   scheduledAt,
        duration_min:   durationMin ?? 60,
        assigned_tech:  assignedTech ?? '',
        notes:          notes ?? '',
        status:         'booked',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    notify({
      dealershipId,
      type:    'system',
      title:   'Ny servicebokning',
      message: `${customerName || 'Kund'} · ${vehicleName || 'Fordon'} · ${new Date(scheduledAt).toLocaleDateString('sv-SE')}`,
      href:    `/service/bookings/${data.id}`,
    });

    return NextResponse.json({ booking: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
