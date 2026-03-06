import { NextRequest, NextResponse } from 'next/server';
import { capturePaymentIntent } from '@/lib/stripe/client';

/** POST /api/stripe/payment-intent/[intentId]/capture */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    const { intentId } = await params;
    const result = await capturePaymentIntent(intentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Stripe capture]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
