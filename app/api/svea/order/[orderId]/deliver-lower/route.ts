import { NextRequest, NextResponse } from 'next/server';
import { deliverOrderLowerAmount } from '@/lib/svea/client';

/**
 * POST /api/svea/order/[orderId]/deliver-lower
 *
 * Deliver an order at a lower total amount than originally authorised.
 * Use when the final price is less than what the customer authorised
 * (e.g. an accessory was not available at delivery).
 *
 * [orderId] = numeric Svea CheckoutOrderId (paymentOrderId)
 *
 * Body: { deliveredAmount: number }  — in SEK (will be converted to öre)
 *
 * Svea API: POST /api/v1/orders/{orderId}/deliveries/DeliverAndLowerAmount  (Admin, HMAC)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { deliveredAmount } = await req.json() as { deliveredAmount: number };

    if (!deliveredAmount || deliveredAmount <= 0) {
      return NextResponse.json({ error: 'deliveredAmount (SEK) is required' }, { status: 400 });
    }

    const amountOre = Math.round(deliveredAmount * 100);
    const result    = await deliverOrderLowerAmount(orderId, amountOre);

    console.log(`[Svea] DeliverLowerAmount — orderId: ${orderId}, amount: ${deliveredAmount} SEK, deliveryId: ${result.DeliveryId}`);
    return NextResponse.json({ deliveryId: result.DeliveryId });
  } catch (error: any) {
    console.error('[Svea deliver-lower]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
