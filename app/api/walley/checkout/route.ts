import { NextRequest, NextResponse } from 'next/server';
import { createCheckout } from '@/lib/walley/client';

/** POST /api/walley/checkout — create a Walley checkout session */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { purchaseIdentifier, cart, customer, currency, callbackUrl } = body;

    if (!purchaseIdentifier || !cart) {
      return NextResponse.json(
        { error: 'Missing required fields: purchaseIdentifier, cart' },
        { status: 400 },
      );
    }

    const result = await createCheckout({
      purchaseIdentifier,
      cart,
      customer,
      currency: currency ?? 'SEK',
      callbackUrl: callbackUrl ?? `${process.env.NEXT_PUBLIC_BASE_URL}/api/walley/callback`,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Walley POST checkout]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
