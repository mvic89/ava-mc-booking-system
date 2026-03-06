import { NextRequest, NextResponse } from 'next/server';
import { cancelPayment } from '@/lib/adyen/client';

/** POST /api/adyen/payment/[paymentPspReference]/cancel */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentPspReference: string }> },
) {
  try {
    const { paymentPspReference } = await params;
    const result = await cancelPayment(paymentPspReference);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Adyen cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
