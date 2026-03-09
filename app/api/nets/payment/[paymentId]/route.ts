import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/nets/client';

/** GET /api/nets/payment/[paymentId] — retrieve payment details */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    const result = await getPayment(paymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Nets GET payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
