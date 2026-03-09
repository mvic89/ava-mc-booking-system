import { NextRequest, NextResponse } from 'next/server';
import { createPayment } from '@/lib/resurs/client';

/**
 * POST /api/resurs/payment
 *
 * Create a Resurs Bank payment (financing/invoice).
 * Returns signingUrl — redirect customer here for BankID signing.
 *
 * Body: { storeId, paymentMethodId, orderReference, customer, orderLines, signing }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeId, paymentMethodId, orderReference, customer, orderLines, signing } = body;

    if (!storeId || !paymentMethodId || !orderReference || !customer) {
      return NextResponse.json(
        { error: 'Missing required fields: storeId, paymentMethodId, orderReference, customer' },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const result = await createPayment({
      storeId,
      paymentMethodId,
      orderReference,
      customer,
      orderLines: orderLines ?? [],
      signing: signing ?? {
        successUrl: `${baseUrl}/sales/leads`,
        failUrl:    `${baseUrl}/sales/leads`,
      },
    });

    console.log(`[Resurs] Payment created — id: ${result.paymentId}, status: ${result.status}`);
    return NextResponse.json({
      paymentId:  result.paymentId,
      status:     result.status,
      signingUrl: result.signingUrl ?? null,
    });
  } catch (error: any) {
    console.error('[Resurs POST payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
