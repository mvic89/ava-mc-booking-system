import { NextRequest, NextResponse } from 'next/server';
import { createCheckout } from '@/lib/qliro/client';

/** POST /api/qliro/checkout — create a Qliro One checkout */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderLines, currency, country, merchantOrderId, customer } = body;

    if (!orderLines || !merchantOrderId) {
      return NextResponse.json(
        { error: 'Missing required fields: orderLines, merchantOrderId' },
        { status: 400 },
      );
    }

    const result = await createCheckout({
      orderLines,
      currency: currency ?? 'SEK',
      country: country ?? 'SE',
      merchantOrderId,
      customer,
      callbackUrl:  `${process.env.NEXT_PUBLIC_BASE_URL}/api/qliro/callback`,
      successUrl:   `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success`,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Qliro POST checkout]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
