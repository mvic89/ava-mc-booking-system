import { NextRequest, NextResponse } from 'next/server';
import { cancelInstoreOrder } from '@/lib/svea/client';

/**
 * POST /api/svea/order/[orderId]/cancel
 *
 * Cancels an active Svea Instore order.
 * Use this if the customer changes their mind before signing with BankID,
 * or if the link expires and you want to resend.
 *
 * Uses the Instore API:
 *   POST /api/v1/orders/{orderId}/cancel
 *   Auth: Basic Auth
 *
 * The orderId here is the merchantOrderNumber (e.g. "AGR-2024-0089-MM3JJSJL"),
 * NOT the numeric paymentOrderId. The Instore API uses merchantOrderNumber as path ID.
 *
 * Note: For post-delivery refunds/credits, use the Payment Admin API
 * credit endpoints instead (not handled here).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    await cancelInstoreOrder(orderId);

    console.log(`[Svea] Order cancelled — orderId: ${orderId}`);

    return NextResponse.json({
      success: true,
      orderId,
      cancelledAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Svea cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
