import { NextRequest, NextResponse } from 'next/server';
import { addOrderRow, addOrderRows, type SveaOrderRowInput } from '@/lib/svea/client';

/**
 * POST /api/svea/order/[orderId]/rows
 *
 * Add one or multiple rows to an existing order before delivery.
 * [orderId] = numeric Svea CheckoutOrderId
 *
 * Body (single row):   { row: SveaOrderRowInput }
 * Body (multiple rows): { rows: SveaOrderRowInput[] }
 *
 * SveaOrderRowInput fields:
 *   Name (required), Quantity (×100), UnitPrice (öre), VatPercent (e.g. 2500),
 *   ArticleNumber?, DiscountPercent?, DiscountAmount?, Unit?
 *
 * Svea API:
 *   Single: POST /api/v1/orders/{orderId}/rows/             (Admin, HMAC)
 *   Multi:  POST /api/v1/orders/{orderId}/rows/addOrderRows/ (Admin, HMAC)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const body        = await req.json() as { row?: SveaOrderRowInput; rows?: SveaOrderRowInput[] };

    if (body.rows?.length) {
      const result = await addOrderRows(orderId, body.rows);
      console.log(`[Svea] Added ${body.rows.length} rows to order ${orderId}`);
      return NextResponse.json({ orderRowIds: result.OrderRowIds });
    }

    if (body.row) {
      const result = await addOrderRow(orderId, body.row);
      console.log(`[Svea] Added row to order ${orderId} — rowId: ${result.OrderRowId}`);
      return NextResponse.json({ orderRowId: result.OrderRowId });
    }

    return NextResponse.json({ error: 'Provide either "row" or "rows" in the body' }, { status: 400 });
  } catch (error: any) {
    console.error('[Svea rows POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
