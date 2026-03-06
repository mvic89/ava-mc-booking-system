import { NextRequest, NextResponse } from 'next/server';
import { createPaymentRequest } from '@/lib/swish/client';

/**
 * POST /api/swish/payment — initiate a Swish payment request
 * Body: { payerAlias, amount, currency?, message?, orderId }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payerAlias, amount, currency, message, orderId } = body;

    if (!payerAlias || !amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields: payerAlias, amount, orderId' },
        { status: 400 },
      );
    }

    const paymentId = await createPaymentRequest({
      payerAlias,
      amount,
      currency:    currency ?? 'SEK',
      message:     message ?? orderId,
      callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/swish/callback`,
    });

    console.log(`[Swish] Payment request created: ${paymentId}`);
    return NextResponse.json({ paymentId });
  } catch (error: any) {
    console.error('[Swish POST payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
