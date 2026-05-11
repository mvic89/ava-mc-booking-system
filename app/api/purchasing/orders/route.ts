import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/purchasing/orders?dealershipId=…&workOrderId=…
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  const workOrderId  = req.nextUrl.searchParams.get('workOrderId');
  if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

  let q = sb()
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('dealership_id', dealershipId)
    .order('date', { ascending: false });

  if (workOrderId) q = q.eq('work_order_id', Number(workOrderId));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

// POST /api/purchasing/orders — create a PO from a work order's pending parts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealershipId, workOrderId, vendorId, vendor, notes, eta, items } = body;
    if (!dealershipId || !vendor || !items?.length) {
      return NextResponse.json({ error: 'dealershipId, vendor, and items are required' }, { status: 400 });
    }

    // Compute total
    const totalCost = items.reduce(
      (sum: number, it: { quantity: number; unit_cost: number }) => sum + it.quantity * it.unit_cost,
      0,
    );

    // Generate PO id (PO-YYYYMMDD-random)
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand     = Math.random().toString(36).slice(2, 6).toUpperCase();
    const poId     = `PO-${datePart}-${rand}`;

    const { data: po, error: poErr } = await sb()
      .from('purchase_orders')
      .insert({
        id:            poId,
        dealership_id: dealershipId,
        vendor_id:     vendorId ?? null,
        vendor,
        work_order_id: workOrderId ? Number(workOrderId) : null,
        date:          new Date().toISOString(),
        eta:           eta ?? null,
        status:        'Draft',
        total_cost:    totalCost,
        notes:         notes ?? null,
      })
      .select()
      .single();

    if (poErr) return NextResponse.json({ error: poErr.message }, { status: 500 });

    // Insert line items
    const lineItems = items.map((it: {
      workOrderPartId?: number;
      articleNumber:   string;
      name:            string;
      quantity:        number;
      unitCost:        number;
    }) => ({
      purchase_order_id:  poId,
      work_order_id:      workOrderId ? Number(workOrderId) : null,
      work_order_part_id: it.workOrderPartId ?? null,
      article_number:     it.articleNumber ?? '',
      name:               it.name,
      quantity:           it.quantity,
      unit_cost:          it.unitCost,
      total_cost:         it.quantity * it.unitCost,
      status:             'ordered',
    }));

    const { error: itemErr } = await sb().from('purchase_order_items').insert(lineItems);
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

    // Link work_order_parts to this PO + set status to 'ordered'
    if (workOrderId) {
      const partIds = items
        .filter((it: { workOrderPartId?: number }) => it.workOrderPartId)
        .map((it: { workOrderPartId: number }) => it.workOrderPartId);

      if (partIds.length) {
        await sb()
          .from('work_order_parts')
          .update({ purchase_order_id: poId, status: 'ordered' })
          .in('id', partIds);
      }

      // Set work order to waiting_parts
      await sb()
        .from('work_orders')
        .update({ status: 'waiting_parts', updated_at: new Date().toISOString() })
        .eq('id', Number(workOrderId))
        .eq('dealership_id', dealershipId);

      notify({
        dealershipId,
        type: 'info',
        title: 'Inköpsorder skapad',
        message: `${poId} · ${vendor} · ${items.length} artiklar`,
        href: `/purchase-orders`,
      });
    }

    return NextResponse.json({ order: po }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
