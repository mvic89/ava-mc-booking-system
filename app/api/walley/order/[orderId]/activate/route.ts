import { NextRequest, NextResponse } from 'next/server';
import { activateOrder } from '@/lib/walley/client';

/** POST /api/walley/order/[orderId]/activate — capture/activate a Walley order (triggers payout) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    await activateOrder(orderId);
    console.log(`[Walley] Order ${orderId} activated`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Walley activate]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
