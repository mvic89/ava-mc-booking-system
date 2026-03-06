import { NextRequest, NextResponse } from 'next/server';
import { cancelOrderRows } from '@/lib/svea/client';

/**
 * PATCH /api/svea/order/[orderId]/rows/cancel
 *
 * Cancel multiple order rows at once.
 * [orderId] = numeric Svea CheckoutOrderId
 *
 * Body: { rowIds: number[] }
 *
 * Svea API: PATCH /api/v1/orders/{orderId}/rows/cancelOrderRows/  (Admin, HMAC)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { rowIds }  = await req.json() as { rowIds: number[] };

    if (!rowIds?.length) {
      return NextResponse.json({ error: 'rowIds array is required' }, { status: 400 });
    }

    await cancelOrderRows(orderId, rowIds);
    console.log(`[Svea] Cancelled ${rowIds.length} rows on order ${orderId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Svea rows/cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
