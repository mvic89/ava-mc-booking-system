import { NextRequest, NextResponse } from 'next/server';
import { replaceOrderRows, type SveaOrderRowInput } from '@/lib/svea/client';

/**
 * PUT /api/svea/order/[orderId]/rows/replace
 *
 * Replace ALL existing order rows with a new set.
 * Old rows are cancelled. Use when the cart changes significantly before delivery.
 * [orderId] = numeric Svea CheckoutOrderId
 *
 * Body: { rows: SveaOrderRowInput[] }
 *
 * Svea API: PUT /api/v1/orders/{orderId}/rows/replaceOrderRows  (Admin, HMAC)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { rows }    = await req.json() as { rows: SveaOrderRowInput[] };

    if (!rows?.length) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
    }

    await replaceOrderRows(orderId, rows);
    console.log(`[Svea] Replaced all rows on order ${orderId} with ${rows.length} new row(s)`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Svea rows/replace]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
