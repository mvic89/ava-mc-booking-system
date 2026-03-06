import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/swish/callback
 * Swish pushes payment/refund status updates here.
 * In production: verify the request comes from Swish MSS IP ranges.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Swish callback]', JSON.stringify(body));

    const { id, status, paymentReference, errorCode, errorMessage } = body;

    if (status === 'PAID') {
      console.log(`[Swish] Payment ${id} succeeded — ref: ${paymentReference}`);
      // TODO: update order status in DB
    } else if (status === 'DECLINED' || status === 'ERROR') {
      console.warn(`[Swish] Payment ${id} failed — ${errorCode}: ${errorMessage}`);
      // TODO: handle failure
    }

    // Swish expects HTTP 200 (no body required)
    return new NextResponse(null, { status: 200 });
  } catch (error: any) {
    console.error('[Swish callback error]', error.message);
    return new NextResponse(null, { status: 200 }); // always 200 to Swish
  }
}
