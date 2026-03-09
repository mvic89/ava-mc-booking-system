import { NextRequest, NextResponse } from 'next/server';
import { chargePayment } from '@/lib/nets/client';

/** POST /api/nets/payment/[paymentId]/charge
 *  Body: { amount: number, orderItems: NetsOrderItem[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    const { amount, orderItems } = await req.json();
    if (!amount || !orderItems) {
      return NextResponse.json({ error: 'amount and orderItems are required' }, { status: 400 });
    }

    const result = await chargePayment(paymentId, { amount, orderItems });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Nets charge]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
