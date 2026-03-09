import { NextRequest, NextResponse } from 'next/server';
import { createPayment } from '@/lib/nets/client';

/**
 * POST /api/nets/payment — create a Nets Easy payment
 * Body: { order, checkout }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order, checkout } = body;

    if (!order || !checkout) {
      return NextResponse.json(
        { error: 'Missing required fields: order, checkout' },
        { status: 400 },
      );
    }

    const result = await createPayment({ order, checkout });
    console.log(`[Nets] Payment created: ${result.paymentId}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Nets POST payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
