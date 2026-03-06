import { NextRequest, NextResponse } from 'next/server';
import {
  creditOrderRows,
  creditOrderRowsWithFee,
  creditDeliveryAmount,
  type SveaFeeRow,
} from '@/lib/svea/client';

/**
 * POST /api/svea/order/[orderId]/deliveries/[deliveryId]/credits
 *
 * Credit (refund) a delivered order. Three modes:
 *
 *   1. Credit specific rows:
 *      Body: { rowIds: number[] }
 *
 *   2. Credit specific rows + add a restocking/handling fee:
 *      Body: { rowIds: number[], fee: SveaFeeRow }
 *
 *   3. Credit a monetary amount (no row IDs needed):
 *      Body: { amount: number }  — in SEK
 *
 * [orderId]    = numeric Svea CheckoutOrderId
 * [deliveryId] = numeric DeliveryId from the deliver endpoint
 *
 * Svea API:
 *   POST  /api/v1/orders/{orderId}/deliveries/{deliveryId}/credits/            (rows)
 *   POST  /api/v1/orders/{orderId}/deliveries/{deliveryId}/credits/CreditWithFee
 *   PATCH /api/v1/orders/{orderId}/deliveries/{deliveryId}/                    (amount)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; deliveryId: string }> },
) {
  try {
    const { orderId, deliveryId } = await params;
    const body = await req.json() as {
      rowIds?: number[];
      fee?:    SveaFeeRow;
      amount?: number;
    };

    if (body.amount != null) {
      const amountOre = Math.round(body.amount * 100);
      const result    = await creditDeliveryAmount(orderId, deliveryId, amountOre);
      console.log(`[Svea] Credited ${body.amount} SEK on delivery ${deliveryId} — creditId: ${result.CreditId}`);
      return NextResponse.json({ creditId: result.CreditId });
    }

    if (body.rowIds?.length) {
      const result = body.fee
        ? await creditOrderRowsWithFee(orderId, deliveryId, body.rowIds, body.fee)
        : await creditOrderRows(orderId, deliveryId, body.rowIds);
      console.log(`[Svea] Credited rows [${body.rowIds}] on delivery ${deliveryId} — creditId: ${result.CreditId}`);
      return NextResponse.json({ creditId: result.CreditId });
    }

    return NextResponse.json(
      { error: 'Provide either "rowIds" (with optional "fee") or "amount" in the body' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error('[Svea credits]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
