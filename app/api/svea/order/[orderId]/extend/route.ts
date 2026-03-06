import { NextRequest, NextResponse } from 'next/server';
import { extendOrder } from '@/lib/svea/client';

/**
 * PATCH /api/svea/order/[orderId]/extend
 *
 * Extend an order's expiry date. Use when a customer needs more time to
 * complete payment or the delivery is delayed.
 * [orderId] = numeric Svea CheckoutOrderId
 *
 * Body: { expiryDate: string }  — ISO 8601 date, e.g. "2024-12-31"
 *
 * Svea API: PATCH /api/v1/orders/{orderId}/extendOrder/{expiryDate}/  (Admin, HMAC)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId }  = await params;
    const { expiryDate } = await req.json() as { expiryDate: string };

    if (!expiryDate) {
      return NextResponse.json({ error: 'expiryDate (ISO 8601) is required' }, { status: 400 });
    }

    await extendOrder(orderId, expiryDate);
    console.log(`[Svea] Extended order ${orderId} expiry to ${expiryDate}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Svea extend]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
