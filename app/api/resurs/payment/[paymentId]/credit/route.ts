import { NextRequest, NextResponse } from 'next/server';
import { creditPayment } from '@/lib/resurs/client';

/** POST /api/resurs/payment/[paymentId]/credit — Body: { orderLines } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    const { orderLines } = await req.json();
    await creditPayment(paymentId, { orderLines: orderLines ?? [] });
    console.log(`[Resurs] Payment ${paymentId} credited`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Resurs credit]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
