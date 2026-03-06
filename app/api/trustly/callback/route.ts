import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/trustly/callback
 * Trustly sends JSON-RPC notifications here (credit, pending, cancel).
 * In production: verify RSA signature on the notification.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Trustly callback]', JSON.stringify(body));

    const method = body?.method;
    const params = body?.params ?? {};

    if (method === 'credit') {
      const { orderid, amount, currency } = params;
      console.log(`[Trustly] Credit received — orderId: ${orderid}, ${amount} ${currency}`);
      // TODO: mark order as paid in DB
    } else if (method === 'cancel') {
      const { orderid } = params;
      console.log(`[Trustly] Order cancelled — orderId: ${orderid}`);
      // TODO: handle cancellation
    } else if (method === 'pending') {
      console.log(`[Trustly] Payment pending — orderId: ${params.orderid}`);
    }

    // Trustly expects JSON-RPC success response
    return NextResponse.json({ result: { status: 'OK' }, id: body?.id ?? null });
  } catch (error: any) {
    console.error('[Trustly callback error]', error.message);
    return NextResponse.json({ result: { status: 'OK' }, id: null });
  }
}
