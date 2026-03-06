import { NextRequest, NextResponse } from 'next/server';
import { refundPayment } from '@/lib/nets/client';

/** POST /api/nets/charge/[chargeId]/refund
 *  Body: { amount: number, orderItems: NetsOrderItem[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chargeId: string }> },
) {
  try {
    const { chargeId } = await params;
    const { amount, orderItems } = await req.json();
    if (!amount || !orderItems) {
      return NextResponse.json({ error: 'amount and orderItems are required' }, { status: 400 });
    }

    const result = await refundPayment(chargeId, { amount, orderItems });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Nets refund]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
