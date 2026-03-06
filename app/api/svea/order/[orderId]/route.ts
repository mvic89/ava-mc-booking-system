import { NextRequest, NextResponse } from 'next/server';
import { getInstoreOrderStatus } from '@/lib/svea/client';

/**
 * GET /api/svea/order/[orderId]
 *
 * Polls the status of a Svea Instore order.
 * Uses the Instore API: GET /api/v1/orders/{merchantOrderNumber}/status (Basic Auth).
 *
 * IMPORTANT: The Instore API uses merchantOrderNumber as the path identifier,
 * NOT the numeric paymentOrderId. Pass the full merchant order number, e.g.:
 *   GET /api/svea/order/AGR-2024-0089-MM3JJSJL
 *
 * Status values returned by Svea Instore:
 *   "Active"    → SMS sent, customer hasn't acted yet
 *   "Confirmed" → customer selected plan and signed with BankID ✅
 *   "Cancelled" → order was cancelled
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const order = await getInstoreOrderStatus(orderId);

    return NextResponse.json({
      orderId:             order.paymentOrderId  ?? order.OrderId,
      status:              order.orderStatus     ?? order.Status,
      merchantOrderNumber: order.merchantOrderNumber ?? order.MerchantOrderNumber,
    });
  } catch (error: any) {
    console.error('[Svea GET instore status]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
