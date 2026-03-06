import { NextRequest, NextResponse } from 'next/server';
import { getPaymentIntent } from '@/lib/stripe/client';

/** GET /api/stripe/payment-intent/[intentId] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    const { intentId } = await params;
    const result = await getPaymentIntent(intentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Stripe GET payment-intent]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
