import { NextRequest, NextResponse } from 'next/server';
import { deliverOrder } from '@/lib/svea/client';

/**
 * POST /api/svea/order/[orderId]/deliver
 *
 * Triggers Svea to release funds to the dealer.
 * Call this when the bike is physically handed over to the customer.
 *
 * Uses the Payment Admin API:
 *   POST /api/v1/orders/{orderId}/deliveries
 *   Body: { "OrderRowIds": [] }  (empty = deliver all rows)
 *   Auth: HMAC-SHA512
 *
 * The orderId here is the paymentOrderId returned by createInstoreOrder.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    await deliverOrder(orderId);

    console.log(`[Svea] ✅ Order delivered — orderId: ${orderId}`);

    return NextResponse.json({
      success: true,
      orderId,
      deliveredAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Svea deliver]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
