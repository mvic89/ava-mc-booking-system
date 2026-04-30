import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { sendServiceEmail, bookingConfirmedMessage } from '@/lib/serviceEmail';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/bookings/[id]?dealershipId=…
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ booking: null });

  const { data, error } = await sb()
    .from('service_bookings')
    .select('*')
    .eq('id', Number(id))
    .eq('dealership_id', dealershipId)
    .single();

  if (error) return NextResponse.json({ booking: null });
  return NextResponse.json({ booking: data });
}

// PATCH /api/service/bookings/[id] — update status, notes, assigned_tech, or convert to work order
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId, status, notes, assignedTech, workOrderId } = body;
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    // Build update payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status      !== undefined) update.status         = status;
    if (notes       !== undefined) update.notes          = notes;
    if (assignedTech!== undefined) update.assigned_tech  = assignedTech;
    if (workOrderId !== undefined) update.work_order_id  = workOrderId;

    const { data, error } = await sb()
      .from('service_bookings')
      .update(update)
      .eq('id', Number(id))
      .eq('dealership_id', dealershipId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (status === 'confirmed') {
      notify({
        dealershipId,
        type:    'system',
        title:   'Bokning bekräftad',
        message: `${data.customer_name} · ${data.vehicle_name} · ${new Date(data.scheduled_at).toLocaleDateString('sv-SE')}`,
        href:    `/service/bookings/${id}`,
      });

      // Auto-email the customer
      const customerEmail = body.customerEmail ?? data.customer_email ?? null;
      if (customerEmail) {
        const { data: dealer } = await sb()
          .from('dealerships').select('name').eq('id', dealershipId).maybeSingle();
        const dealerName = dealer?.name ?? 'Verkstaden';
        const { subject, message } = bookingConfirmedMessage(data.customer_name, data.vehicle_name, data.scheduled_at, dealerName);
        sendServiceEmail({ dealershipId, customerId: data.customer_id, recipientName: data.customer_name, recipientEmail: customerEmail, subject, message });
      }
    }

    return NextResponse.json({ booking: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
