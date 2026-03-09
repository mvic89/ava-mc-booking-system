import { NextRequest, NextResponse } from 'next/server';
import { finalizePayment } from '@/lib/resurs/client';

/** POST /api/resurs/payment/[paymentId]/finalize — Body: { orderLines } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    const { orderLines } = await req.json();
    await finalizePayment(paymentId, orderLines ?? []);
    console.log(`[Resurs] Payment ${paymentId} finalized`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Resurs finalize]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
