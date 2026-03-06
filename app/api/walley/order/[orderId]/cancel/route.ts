import { NextRequest, NextResponse } from 'next/server';
import { cancelOrder } from '@/lib/walley/client';

/** POST /api/walley/order/[orderId]/cancel */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    await cancelOrder(orderId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Walley cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
