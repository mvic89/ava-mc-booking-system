import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

/**
 * POST /api/purchasing/orders/[id]/receive
 * Body: { dealershipId, itemIds?: number[] }
 *
 * Marks purchase_order_items as 'received'.
 * If itemIds is omitted, receives ALL items on the PO.
 * Then:
 *   - Updates linked work_order_parts to 'received'
 *   - If all parts on linked work order are ready → auto-advance to in_progress
 *   - If all items on PO received → mark PO 'Reviewed'
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId, itemIds } = body;
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    // Fetch the PO + its items
    const { data: po, error: poErr } = await sb()
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('id', id)
      .eq('dealership_id', dealershipId)
      .single();

    if (poErr || !po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    const now = new Date().toISOString();
    const targetIds: number[] = itemIds?.length
      ? itemIds
      : po.purchase_order_items.map((i: { id: number }) => i.id);

    // Mark items as received
    await sb()
      .from('purchase_order_items')
      .update({ status: 'received', received_at: now })
      .in('id', targetIds);

    // Update linked work_order_parts to received
    const linkedPartIds = po.purchase_order_items
      .filter((i: { id: number; work_order_part_id: number | null }) =>
        targetIds.includes(i.id) && i.work_order_part_id,
      )
      .map((i: { work_order_part_id: number }) => i.work_order_part_id);

    if (linkedPartIds.length) {
      await sb()
        .from('work_order_parts')
        .update({ status: 'received' })
        .in('id', linkedPartIds);
    }

    // Check if all PO items are now received → mark PO Reviewed
    const { data: allItems } = await sb()
      .from('purchase_order_items')
      .select('status')
      .eq('purchase_order_id', id);

    const allReceived = allItems?.every((i: { status: string }) => i.status === 'received');
    if (allReceived) {
      await sb()
        .from('purchase_orders')
        .update({ status: 'Reviewed', updated_at: now })
        .eq('id', id);
    }

    // If linked to a work order, check if all work_order_parts are ready
    if (po.work_order_id) {
      const { data: woParts } = await sb()
        .from('work_order_parts')
        .select('status')
        .eq('work_order_id', po.work_order_id);

      const allReady = woParts?.every((p: { status: string }) =>
        p.status === 'received' || p.status === 'used' || p.status === 'reserved',
      );

      if (allReady) {
        const { data: wo } = await sb()
          .from('work_orders')
          .select('status, vehicle_name, customer_name')
          .eq('id', po.work_order_id)
          .single();

        if (wo?.status === 'waiting_parts') {
          await sb()
            .from('work_orders')
            .update({ status: 'in_progress', updated_at: now })
            .eq('id', po.work_order_id)
            .eq('dealership_id', dealershipId);

          notify({
            dealershipId,
            type: 'success',
            title: 'Reservdelar inkomna — arbete återupptaget',
            message: `AO-${po.work_order_id} · ${wo.vehicle_name ?? ''} · ${wo.customer_name ?? ''}`,
            href: `/service/orders/${po.work_order_id}`,
          });
        }
      }
    }

    return NextResponse.json({ received: targetIds.length, allReceived });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
