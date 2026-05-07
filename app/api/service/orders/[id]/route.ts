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
    if (body.status === 'ready') {
      // customer_email is not stored on work_orders — look it up from customers table
      let customerEmail: string | null = data.customer_email ?? null;
      if (!customerEmail && data.customer_id) {
        const { data: cust } = await sb()
          .from('customers').select('email').eq('id', data.customer_id).maybeSingle();
        customerEmail = cust?.email ?? null;
      }
      if (customerEmail) {
        const { data: dealer } = await sb()
          .from('dealerships').select('name').eq('id', dealershipId).maybeSingle();
        const dealerName = dealer?.name ?? 'Verkstaden';
        const { subject, message } = vehicleReadyMessage(data.customer_name, data.vehicle_name, data.plate, dealerName);
        sendServiceEmail({ dealershipId, customerId: data.customer_id, recipientName: data.customer_name, recipientEmail: customerEmail, subject, message });
      }
    }

    return NextResponse.json({ order: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/service/orders/[id]?dealershipId=…
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    // Restore stock for any parts that were reserved from inventory
    const { data: parts } = await sb()
      .from('work_order_parts')
      .select('part_number, name, quantity, status')
      .eq('work_order_id', Number(id));

    if (parts?.length) {
      const reserved = (parts as { part_number: string; name: string; quantity: number; status: string }[])
        .filter(p => ['reserved', 'used'].includes(p.status));

      for (const p of reserved) {
        for (const table of ['spare_parts', 'accessories'] as const) {
          const q = p.part_number
            ? sb().from(table).select('id, stock').eq('dealership_id', dealershipId).ilike('article_number', p.part_number).maybeSingle()
            : sb().from(table).select('id, stock').eq('dealership_id', dealershipId).ilike('name', p.name).maybeSingle();
          const { data: inv } = await q;
          if (inv) {
            await sb().from(table).update({ stock: (inv.stock ?? 0) + p.quantity }).eq('id', inv.id);
            break;
          }
        }
      }
    }

    // Remove related rows first to avoid FK constraint errors
    await Promise.all([
      sb().from('work_order_tasks').delete().eq('work_order_id', Number(id)),
      sb().from('work_order_parts').delete().eq('work_order_id', Number(id)),
      sb().from('tech_time_entries').delete().eq('work_order_id', Number(id)),
    ]);

    const { error } = await sb()
      .from('work_orders')
      .delete()
      .eq('id', Number(id))
      .eq('dealership_id', dealershipId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
