import { NextRequest, NextResponse } from 'next/server';
import { cancelPayment } from '@/lib/nets/client';

/** POST /api/nets/payment/[paymentId]/cancel — Body: { amount } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    const { amount } = await req.json();
    if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 });

    await cancelPayment(paymentId, amount);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Nets cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
