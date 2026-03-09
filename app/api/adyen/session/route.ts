import { NextRequest, NextResponse } from 'next/server';
import { createPaymentSession } from '@/lib/adyen/client';

/**
 * POST /api/adyen/session — create an Adyen checkout session
 * Body: { amount, currency?, reference, returnUrl, countryCode? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, reference, returnUrl, countryCode } = body;

    if (!amount || !reference || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, reference, returnUrl' },
        { status: 400 },
      );
    }

    const result = await createPaymentSession({
      amount,
      currency:    currency ?? 'SEK',
      reference,
      returnUrl,
      countryCode: countryCode ?? 'SE',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Adyen POST session]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
