import { NextRequest, NextResponse } from 'next/server';
import { updateOrderRow, cancelOrderRow, type SveaOrderRowInput } from '@/lib/svea/client';

/**
 * PATCH /api/svea/order/[orderId]/rows/[rowId]
 *
 * Update or cancel a single order row.
 * [orderId] = numeric Svea CheckoutOrderId
 * [rowId]   = numeric OrderRowId
 *
 * Body to UPDATE: { updates: Partial<SveaOrderRowInput> }
 *   e.g. { updates: { UnitPrice: 50000, Quantity: 100 } }
 *
 * Body to CANCEL: { cancel: true }
 *
 * Svea API: PATCH /api/v1/orders/{orderId}/rows/{rowId}/  (Admin, HMAC)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; rowId: string }> },
) {
  try {
    const { orderId, rowId } = await params;
    const rowIdNum           = Number(rowId);
    const body               = await req.json() as { cancel?: boolean; updates?: Partial<SveaOrderRowInput> };

    if (body.cancel) {
      await cancelOrderRow(orderId, rowIdNum);
      console.log(`[Svea] Cancelled row ${rowId} on order ${orderId}`);
      return NextResponse.json({ success: true });
    }

    if (body.updates) {
      await updateOrderRow(orderId, rowIdNum, body.updates);
      console.log(`[Svea] Updated row ${rowId} on order ${orderId}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Provide either "cancel: true" or "updates" in the body' }, { status: 400 });
  } catch (error: any) {
    console.error('[Svea rows/[rowId] PATCH]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
