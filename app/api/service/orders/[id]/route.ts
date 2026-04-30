import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { sendServiceEmail, vehicleReadyMessage } from '@/lib/serviceEmail';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/orders/[id]?dealershipId=…
// Returns work order + tasks + parts + time entries
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ order: null, tasks: [], parts: [], time: [] });

  const [orderRes, tasksRes, partsRes, timeRes] = await Promise.all([
    sb().from('work_orders').select('*').eq('id', Number(id)).eq('dealership_id', dealershipId).single(),
    sb().from('work_order_tasks').select('*').eq('work_order_id', Number(id)).order('created_at'),
    sb().from('work_order_parts').select('*').eq('work_order_id', Number(id)).order('created_at'),
    sb().from('tech_time_entries').select('*').eq('work_order_id', Number(id)).order('clocked_in_at', { ascending: false }),
  ]);

  return NextResponse.json({
    order: orderRes.data ?? null,
    tasks: tasksRes.data ?? [],
    parts: partsRes.data ?? [],
    time:  timeRes.data  ?? [],
  });
}

// PATCH /api/service/orders/[id] — update status, notes, assigned_tech, costs, mileage
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId } = body;
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    const allowed = [
      'status','priority','assigned_tech','description','internal_notes',
      'mileage','labor_rate','parts_cost','labor_cost','total_cost','invoice_id',
    ] as const;
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    if (body.status === 'in_progress' && !body.started_at) {
      update.started_at = new Date().toISOString();
    }
    if (body.status === 'completed') {
      update.completed_at = new Date().toISOString();
    }

    const { data, error } = await sb()
      .from('work_orders')
      .update(update)
      .eq('id', Number(id))
      .eq('dealership_id', dealershipId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const statusNotifs: Partial<Record<string, { title: string; message: string }>> = {
      in_progress:   { title: 'Arbete påbörjat',           message: `AO-${id} · ${data.vehicle_name}` },
      waiting_parts: { title: 'Väntar på reservdelar',     message: `AO-${id} · ${data.customer_name}` },
      ready:         { title: 'Fordon klart för hämtning ✓', message: `AO-${id} · ${data.vehicle_name} · ${data.customer_name}` },
      completed:     { title: 'Arbetsorder slutförd',      message: `AO-${id} · ${data.vehicle_name}` },
    };

    const notif = statusNotifs[body.status];
    if (notif) {
      notify({ dealershipId, type: 'system', ...notif, href: `/service/orders/${id}` });
    }

    // Auto-email customer when vehicle is ready for pickup
    if (body.status === 'ready' && data.customer_phone) {
      const { data: dealer } = await sb()
        .from('dealerships').select('name').eq('id', dealershipId).maybeSingle();
      const dealerName = dealer?.name ?? 'Verkstaden';
      const customerEmail = body.customerEmail ?? data.customer_email ?? null;
      if (customerEmail) {
        const { subject, message } = vehicleReadyMessage(data.customer_name, data.vehicle_name, data.plate, dealerName);
        sendServiceEmail({ dealershipId, customerId: data.customer_id, recipientName: data.customer_name, recipientEmail: customerEmail, subject, message });
      }
    }

    return NextResponse.json({ order: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
