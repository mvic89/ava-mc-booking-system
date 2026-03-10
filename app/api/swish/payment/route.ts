import { NextRequest, NextResponse } from 'next/server';
import { createPaymentRequest } from '@/lib/swish/client';
import { mockSwishStore } from '@/lib/swish/mock-store';

const MOCK = process.env.SWISH_MOCK_MODE === 'true';

/**
 * POST /api/swish/payment — initiate a Swish payment request
 * Body: { payerAlias, amount, currency?, message?, orderId }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payerAlias, amount, currency, message, orderId } = body;

    if (!payerAlias || !amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields: payerAlias, amount, orderId' },
        { status: 400 },
      );
    }

    // ── Mock mode ────────────────────────────────────────────────────────────
    if (MOCK) {
      const paymentId = 'MOCK' + Math.random().toString(36).slice(2, 14).toUpperCase();
      mockSwishStore.set(paymentId, {
        status:     'CREATED',
        payerAlias,
        amount,
        orderId,
        createdAt:  Date.now(),
      });
      // Auto-transition to PAID after 3 seconds (simulates customer approving in app)
      setTimeout(() => mockSwishStore.paid(paymentId), 3000);
      console.log(`[Swish MOCK] Payment created: ${paymentId}`);
      return NextResponse.json({ paymentId });
    }

    // ── Live mode ─────────────────────────────────────────────────────────────
    // Use NEXT_PUBLIC_BASE_URL if set, otherwise derive from request origin
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;

    const paymentId = await createPaymentRequest({
      payerAlias,
      amount,
      currency:              (currency ?? 'SEK') as 'SEK',
      message:               message ?? orderId,
      payeePaymentReference: orderId,
      callbackUrl:           `${origin}/api/swish/callback`,
    });

    console.log(`[Swish] Payment request created: ${paymentId}`);
    return NextResponse.json({ paymentId });
  } catch (error: any) {
    console.error('[Swish POST payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
