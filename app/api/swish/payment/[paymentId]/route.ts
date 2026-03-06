import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRequest, cancelPaymentRequest } from '@/lib/swish/client';

/** GET /api/swish/payment/[paymentId] — check payment status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    const result = await getPaymentRequest(paymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Swish GET payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE /api/swish/payment/[paymentId] — cancel a pending payment */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    await cancelPaymentRequest(paymentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Swish DELETE payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
