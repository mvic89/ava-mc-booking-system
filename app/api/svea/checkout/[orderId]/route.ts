import { NextRequest, NextResponse } from 'next/server';
import {
  getCheckoutOrder,
  updateCheckoutOrder,
  type SveaCheckoutOrderLine,
} from '@/lib/svea/client';

/**
 * GET /api/svea/checkout/[orderId]
 *
 * Retrieve a Checkout order by ID.
 * Returns full order details including status, cart, customer, payment type, and HTML snippet.
 *
 * Svea API: GET /api/orders/{orderId}  (Checkout, HMAC)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PUT /api/svea/checkout/[orderId]
 *
 * Update a Checkout order's cart or merchantData.
 * Only cart and merchantData can be changed after creation.
 * Cannot update a delivered or cancelled order.
 *
 * Body: { cart?: { Items: SveaCheckoutOrderLine[] }, merchantData?: string }
 *
 * Svea API: PUT /api/orders/{orderId}  (Checkout, HMAC)
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const order       = await getCheckoutOrder(orderId);
    console.log(`[Svea Checkout] GET order ${orderId} — status: ${order.Status}`);
    return NextResponse.json(order);
  } catch (error: any) {
    console.error('[Svea checkout GET orderId]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const body        = await req.json() as {
      cart?:         { Items: SveaCheckoutOrderLine[] };
      merchantData?: string;
    };

    if (!body.cart && !body.merchantData) {
      return NextResponse.json({ error: 'Provide "cart" and/or "merchantData"' }, { status: 400 });
    }

    await updateCheckoutOrder(orderId, {
      ...(body.cart         ? { Cart: body.cart }                 : {}),
      ...(body.merchantData ? { MerchantData: body.merchantData } : {}),
    });

    console.log(`[Svea Checkout] Updated order ${orderId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Svea checkout PUT orderId]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
