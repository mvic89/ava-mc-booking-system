import { NextRequest, NextResponse } from 'next/server';
import { initiateDeposit } from '@/lib/trustly/client';

/**
 * POST /api/trustly/deposit — initiate a Trustly instant bank deposit
 * Body: { userId, amount, currency?, orderId, notificationUrl?, successUrl?, failUrl? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, currency, orderId } = body;

    if (!userId || !amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, amount, orderId' },
        { status: 400 },
      );
    }

    const result = await initiateDeposit({
      userId,
      amount,
      currency:        currency ?? 'SEK',
      orderId,
      notificationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/trustly/callback`,
      successUrl:      `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success`,
      failUrl:         `${process.env.NEXT_PUBLIC_BASE_URL}/payment/failed`,
    });

    console.log(`[Trustly] Deposit initiated — orderId: ${orderId}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Trustly POST deposit]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
