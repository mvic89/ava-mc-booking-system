import { NextRequest, NextResponse } from 'next/server';
import { creditOrder } from '@/lib/walley/client';

/** POST /api/walley/order/[orderId]/credit — Body: { items: [{id, quantity, unitPrice?}], fees? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { items, fees } = await req.json();
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    await creditOrder(orderId, { items, fees });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Walley credit]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
