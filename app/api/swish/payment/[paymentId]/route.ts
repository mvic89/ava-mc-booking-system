import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRequest, cancelPaymentRequest } from '@/lib/swish/client';
import { mockSwishStore } from '@/lib/swish/mock-store';

const MOCK = process.env.SWISH_MOCK_MODE === 'true';

/** GET /api/swish/payment/[paymentId] — check payment status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;

    if (MOCK) {
      const p = mockSwishStore.get(paymentId);
      if (!p) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      return NextResponse.json({
        id:               paymentId,
        paymentReference: paymentId,
        status:           p.status,
        amount:           parseFloat(p.amount),
        currency:         'SEK',
        payeeAlias:       process.env.SWISH_PAYEE_ALIAS ?? '1231181189',
        payerAlias:       p.payerAlias,
      });
    }

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
    if (!MOCK) await cancelPaymentRequest(paymentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Swish DELETE payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
