import { NextRequest, NextResponse } from 'next/server';
import { createKlarnaOrder, type KlarnaOrderLine } from '@/lib/klarna/client';

/**
 * POST /api/klarna/order
 *
 * Places a Klarna order after the customer has authorised on the frontend
 * via Klarna.Payments.authorize(). The frontend receives an authorization_token
 * from Klarna and sends it here together with the order details.
 *
 * Klarna re-validates the order against the session before confirming.
 * On success, returns order_id and fraud_status:
 *   ACCEPTED  → payment confirmed, proceed with delivery
 *   PENDING   → under review (Klarna will notify via callback)
 *   REJECTED  → payment rejected, ask customer to use a different method
 */
export async function POST(req: NextRequest) {
  try {
    const { authorization_token, agreementNumber, vehicle, balanceDue } = await req.json() as {
      authorization_token: string;
      agreementNumber:     string;
      vehicle:             string;
      balanceDue:          number;
    };

    const amountMinor = Math.round(balanceDue * 100);
    const taxMinor    = Math.round(amountMinor * 0.2);

    const orderLines: KlarnaOrderLine[] = [
      {
        type:             'physical',
        name:             vehicle,
        quantity:         1,
        unit_price:       amountMinor,
        total_amount:     amountMinor,
        tax_rate:         2500,
        total_tax_amount: taxMinor,
        reference:        agreementNumber,
      },
    ];

    const result = await createKlarnaOrder(authorization_token, {
      purchase_country:    'SE',
      purchase_currency:   'SEK',
      locale:              'sv-SE',
      order_amount:        amountMinor,
      order_tax_amount:    taxMinor,
      order_lines:         orderLines,
      merchant_reference1: agreementNumber,
    });

    console.log(
      `[Klarna] Order placed — order_id: ${result.order_id}, fraud_status: ${result.fraud_status}`,
    );

    return NextResponse.json({
      order_id:     result.order_id,
      fraud_status: result.fraud_status,
    });
  } catch (error: any) {
    console.error('[Klarna order]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
