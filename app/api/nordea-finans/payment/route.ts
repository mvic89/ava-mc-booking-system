import { NextRequest, NextResponse } from 'next/server';
import { createPayment } from '@/lib/nordea_finans/client';

/**
 * POST /api/nordea-finans/payment
 *
 * Initiate a Nordea payment from the customer's account.
 * Requires a valid Nordea access_token (obtained via OAuth2 authorize flow).
 *
 * Body: { access_token, amount, currency, creditorAccount, creditorName, debtorAccount, endToEndId, message? }
 */
export async function POST(req: NextRequest) {
  try {
    const { access_token, ...paymentParams } = await req.json();
    if (!access_token) return NextResponse.json({ error: 'access_token is required' }, { status: 400 });

    const result = await createPayment(access_token, paymentParams);
    console.log(`[Nordea] Payment ${result.paymentId} created, status: ${result.status}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Nordea payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
