import { NextRequest, NextResponse } from 'next/server';
import { submitPaymentDetails } from '@/lib/adyen/client';

/** POST /api/adyen/details — submit additional payment details (3DS, redirects) */
export async function POST(req: NextRequest) {
  try {
    const { details, paymentData } = await req.json();
    if (!details) return NextResponse.json({ error: 'details is required' }, { status: 400 });

    const result = await submitPaymentDetails({ details, paymentData });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Adyen POST details]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
