import { NextRequest, NextResponse } from 'next/server';
import { cancelPaymentIntent } from '@/lib/stripe/client';

/** POST /api/stripe/payment-intent/[intentId]/cancel */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    const { intentId } = await params;
    const result = await cancelPaymentIntent(intentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Stripe cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
