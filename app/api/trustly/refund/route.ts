import { NextRequest, NextResponse } from 'next/server';
import { refundDeposit } from '@/lib/trustly/client';

/** POST /api/trustly/refund — Body: { orderId, amount } */
export async function POST(req: NextRequest) {
  try {
    const { orderId, amount } = await req.json();
    if (!orderId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, amount' },
        { status: 400 },
      );
    }

    const result = await refundDeposit(orderId, amount);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Trustly POST refund]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
