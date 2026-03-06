import { NextRequest, NextResponse } from 'next/server';
import { processTerminalPayment } from '@/lib/stripe/client';

/** POST /api/stripe/terminal/readers/[readerId]/process — Body: { paymentIntentId } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ readerId: string }> },
) {
  try {
    const { readerId } = await params;
    const { paymentIntentId } = await req.json();
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 });
    }

    const result = await processTerminalPayment(readerId, paymentIntentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Stripe terminal process]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
