import { NextRequest, NextResponse } from 'next/server';
import { captureOrder } from '@/lib/qliro/client';

/** POST /api/qliro/order/[orderId]/capture — Body: { amount } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { amount } = await req.json();
    if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 });

    const result = await captureOrder(orderId, amount);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Qliro capture]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
