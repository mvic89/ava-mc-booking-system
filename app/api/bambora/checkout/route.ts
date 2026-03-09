import { NextRequest, NextResponse } from 'next/server';
import { createCheckout } from '@/lib/bambora/client';

/**
 * POST /api/bambora/checkout — create a Bambora checkout session
 * Body: { amount, currency?, orderId, description? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, orderId, description } = body;

    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, orderId' },
        { status: 400 },
      );
    }

    const result = await createCheckout({
      amount,
      currency:       currency ?? 'SEK',
      orderId,
      description:    description ?? orderId,
      acceptUrl:      `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success`,
      cancelUrl:      `${process.env.NEXT_PUBLIC_BASE_URL}/payment/cancelled`,
      callbackUrl:    `${process.env.NEXT_PUBLIC_BASE_URL}/api/bambora/callback`,
    });

    console.log(`[Bambora] Checkout created — orderId: ${orderId}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Bambora POST checkout]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
