import { NextRequest, NextResponse } from 'next/server';
import { updateOrderRows, type SveaOrderRowInput } from '@/lib/svea/client';

/**
 * POST /api/svea/order/[orderId]/rows/update
 *
 * Update multiple order rows at once.
 * [orderId] = numeric Svea CheckoutOrderId
 *
 * Body: { rows: (SveaOrderRowInput & { OrderRowId: number })[] }
 *   Each row must include OrderRowId alongside the fields to update.
 *
 * Svea API: POST /api/v1/orders/{orderId}/rows/updateOrderRows/  (Admin, HMAC)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { rows }    = await req.json() as { rows: (SveaOrderRowInput & { OrderRowId: number })[] };

    if (!rows?.length) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
    }

    await updateOrderRows(orderId, rows);
    console.log(`[Svea] Updated ${rows.length} rows on order ${orderId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Svea rows/update]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
