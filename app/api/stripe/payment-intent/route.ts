import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/stripe/client';

/**
 * POST /api/stripe/payment-intent — create a Stripe Payment Intent
 * Body: { amount, currency?, customerId?, description? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, customerId, description } = body;

    if (!amount) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }

    const result = await createPaymentIntent({
      amount,
      currency:   currency ?? 'sek',
      customerId,
      description,
    });

    console.log(`[Stripe] PaymentIntent created: ${result.id}`);
    return NextResponse.json({
      id:           result.id,
      clientSecret: result.client_secret,
      status:       result.status,
    });
  } catch (error: any) {
    console.error('[Stripe POST payment-intent]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
