import { NextRequest, NextResponse } from 'next/server';
import { getCheckout, updateCheckout } from '@/lib/walley/client';

/** GET /api/walley/checkout/[checkoutId] — retrieve checkout session */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> },
) {
  try {
    const { checkoutId } = await params;
    const result = await getCheckout(checkoutId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Walley GET checkout]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PUT /api/walley/checkout/[checkoutId] — update cart on existing checkout
 *  Body: { items: WalleyOrderItem[], fees?: WalleyOrderItem[] }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> },
) {
  try {
    const { checkoutId } = await params;
    const { items, fees } = await req.json();
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const result = await updateCheckout(checkoutId, items, fees);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Walley PUT checkout]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
