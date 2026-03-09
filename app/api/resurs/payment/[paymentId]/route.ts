import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/resurs/client';

/** GET /api/resurs/payment/[paymentId] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params;
    const result = await getPayment(paymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Resurs GET payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
