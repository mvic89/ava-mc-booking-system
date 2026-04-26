import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/stripe/client';

/**
 * POST /api/stripe/payment-intent — create a Stripe Payment Intent
 * Body: { amount, currency?, customer?, description? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, customer, description, metadata } = body;

    if (!amount) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }

    const result = await createPaymentIntent({
      amount,
      currency:   currency ?? 'sek',
      customer,
      description,
      metadata,   // pass through — should include leadId + dealershipId from payment page
    });

    console.log(`[Stripe] PaymentIntent created: ${result.id}`);
    return NextResponse.json({
      id:           result.id,
      clientSecret: result.client_secret,
      status:       result.status,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Stripe POST payment-intent]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
