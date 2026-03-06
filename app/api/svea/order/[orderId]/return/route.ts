import { NextRequest, NextResponse } from 'next/server';
import { returnInstoreOrder, type SveaReturnItem } from '@/lib/svea/client';

/**
 * POST /api/svea/order/[orderId]/return
 *
 * Return a completed instore order (partial or full refund).
 * [orderId] = merchantOrderNumber (with timestamp suffix, e.g. "AGR-2024-0089-1718000000000")
 *
 * Body: { returnedItems: SveaReturnItem[] }
 *   Each item: { RowNumber, Quantity (×100), UnitPrice (öre), VatPercent (e.g. 2500), ArticleNumber?, Name? }
 *
 * Svea API: POST /api/v1/orders/{merchantOrderNumber}/return  (Instore, Basic Auth)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { returnedItems } = await req.json() as { returnedItems: SveaReturnItem[] };

    if (!returnedItems?.length) {
      return NextResponse.json({ error: 'returnedItems is required' }, { status: 400 });
    }

    await returnInstoreOrder(orderId, returnedItems);

    console.log(`[Svea] Return processed for order ${orderId} — ${returnedItems.length} item(s)`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Svea return]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
