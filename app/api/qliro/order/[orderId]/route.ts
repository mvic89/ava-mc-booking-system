import { NextRequest, NextResponse } from 'next/server';
import { getOrderStatus } from '@/lib/qliro/client';

/** GET /api/qliro/order/[orderId] — get order status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const result = await getOrderStatus(orderId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Qliro GET order]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
