import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/scheduling?dealershipId=…&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns technicians, bookings in range, and open work orders combined
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ technicians: [], bookings: [], orders: [] });

  const from = req.nextUrl.searchParams.get('from');
  const to   = req.nextUrl.searchParams.get('to');

  const techQuery = sb()
    .from('staff_users')
    .select('id, name, email, role, avatar_url')
    .eq('dealership_id', dealershipId)
    .eq('status', 'active')
    .in('role', ['service', 'technician'])
    .order('name');

  let bookingQuery = sb()
    .from('service_bookings')
    .select('*')
    .eq('dealership_id', dealershipId)
    .neq('status', 'cancelled')
    .order('scheduled_at');

  if (from && to) {
    bookingQuery = bookingQuery
      .gte('scheduled_at', `${from}T00:00:00`)
      .lte('scheduled_at', `${to}T23:59:59`);
  }

  const orderQuery = sb()
    .from('work_orders')
    .select('id, customer_name, vehicle_name, plate, assigned_tech, status, priority, description, created_at, total_cost, started_at')
    .eq('dealership_id', dealershipId)
    .in('status', ['created', 'in_progress', 'waiting_parts', 'ready'])
    .order('created_at', { ascending: false });

  const [techRes, bookingRes, orderRes] = await Promise.all([techQuery, bookingQuery, orderQuery]);

  return NextResponse.json({
    technicians: techRes.data  ?? [],
    bookings:    bookingRes.data ?? [],
    orders:      orderRes.data  ?? [],
  });
}

// PATCH /api/service/scheduling — reassign a booking to a technician and/or time
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealershipId, bookingId, assignedTech, scheduledAt, durationMin } = body;
    if (!dealershipId || !bookingId) {
      return NextResponse.json({ error: 'dealershipId and bookingId required' }, { status: 400 });
    }

    const { status } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (assignedTech !== undefined) update.assigned_tech = assignedTech;
    if (scheduledAt  !== undefined) update.scheduled_at  = scheduledAt;
    if (durationMin  !== undefined) update.duration_min  = durationMin;
    if (status       !== undefined) update.status        = status;

    const { data, error } = await sb()
      .from('service_bookings')
      .update(update)
      .eq('id', bookingId)
      .eq('dealership_id', dealershipId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ booking: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
