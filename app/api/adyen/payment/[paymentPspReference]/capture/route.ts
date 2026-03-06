import { NextRequest, NextResponse } from 'next/server';
import { capturePayment } from '@/lib/adyen/client';

/** POST /api/adyen/payment/[paymentPspReference]/capture — Body: { amount, currency? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentPspReference: string }> },
) {
  try {
    const { paymentPspReference } = await params;
    const { amount, currency } = await req.json();
    if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 });

    const result = await capturePayment(paymentPspReference, amount, currency ?? 'SEK');
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Adyen capture]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
