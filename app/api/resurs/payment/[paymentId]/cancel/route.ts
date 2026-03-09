import { NextRequest, NextResponse } from 'next/server';
import { cancelPayment } from '@/lib/resurs/client';

/** POST /api/resurs/payment/[paymentId]/cancel */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    await cancelPayment(paymentId);
    console.log(`[Resurs] Payment ${paymentId} cancelled`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Resurs cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
