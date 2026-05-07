import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// POST /api/service/orders/[id]/parts — add a part, auto-check inventory stock
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId, partNumber, name, quantity, unitCost } = body;
    if (!dealershipId || !name) return NextResponse.json({ error: 'dealershipId and name required' }, { status: 400 });

    const qty   = Number(quantity) || 1;
    let   cost  = Number(unitCost) || 0;
    const pn    = (partNumber ?? '').trim();

    // ── Look up spare_parts then accessories by article_number OR name ────────
    let partStatus = 'needed';
    let inventoryId: string | null = null;

    for (const table of ['spare_parts', 'accessories'] as const) {
      let q = sb()
        .from(table)
        .select('id, stock, selling_price, cost')
        .eq('dealership_id', dealershipId);

      q = pn ? q.ilike('article_number', pn) : q.ilike('name', name.trim());

      const { data: inv } = await q.maybeSingle();

      if (inv) {
        inventoryId = inv.id;
        if (cost === 0) cost = Number(inv.selling_price) || Number(inv.cost) || 0;

        if ((inv.stock ?? 0) >= qty) {
          await sb().from(table).update({ stock: inv.stock - qty }).eq('id', inv.id);
          partStatus = 'reserved';
        }
        break; // found in this table — don't check the other
      }
    }

    const total = Math.round(qty * cost * 100) / 100;

    const { data, error } = await sb()
      .from('work_order_parts')
      .insert({
        dealership_id: dealershipId,
        work_order_id: Number(id),
        part_number:   pn,
        name,
        quantity:      qty,
        unit_cost:     cost,
        total_cost:    total,
        status:        partStatus,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recomputePartsCost(id, dealershipId);

    return NextResponse.json({
      part:         data,
      autoReserved: partStatus === 'reserved',
      inventoryId,
      fromInventory: inventoryId !== null,
    }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/service/orders/[id]/parts — update part status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId, partId, status } = body;
    if (!dealershipId || !partId) return NextResponse.json({ error: 'dealershipId and partId required' }, { status: 400 });

    const { data, error } = await sb()
      .from('work_order_parts')
      .update({ status })
      .eq('id', partId)
      .eq('work_order_id', Number(id))
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-advance work order when all parts are satisfied
    const { data: parts } = await sb()
      .from('work_order_parts')
      .select('status')
      .eq('work_order_id', Number(id));

    const allReady = parts?.every((p: { status: string }) =>
      ['received', 'used', 'reserved'].includes(p.status),
    );

    if (allReady) {
      const { data: wo } = await sb().from('work_orders').select('status').eq('id', Number(id)).single();
      if (wo?.status === 'waiting_parts') {
        await sb().from('work_orders')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', Number(id)).eq('dealership_id', dealershipId);
      }
    }

    return NextResponse.json({ part: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/service/orders/[id]/parts?partId=…&dealershipId=…
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partId       = req.nextUrl.searchParams.get('partId');
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!partId || !dealershipId) return NextResponse.json({ error: 'partId and dealershipId required' }, { status: 400 });

    const { error } = await sb()
      .from('work_order_parts')
      .delete()
      .eq('id', Number(partId))
      .eq('work_order_id', Number(id));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recomputePartsCost(id, dealershipId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function recomputePartsCost(orderId: string, dealershipId: string) {
  const [{ data: parts }, { data: wo }] = await Promise.all([
    sb().from('work_order_parts').select('total_cost').eq('work_order_id', Number(orderId)),
    sb().from('work_orders').select('labor_cost').eq('id', Number(orderId)).single(),
  ]);
  if (!wo || !parts) return;
  const partsCost = parts.reduce((s: number, p: { total_cost: number }) => s + (p.total_cost ?? 0), 0);
  await sb().from('work_orders')
    .update({ parts_cost: partsCost, total_cost: partsCost + (wo.labor_cost ?? 0), updated_at: new Date().toISOString() })
    .eq('id', Number(orderId))
    .eq('dealership_id', dealershipId);
}
