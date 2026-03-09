import { NextRequest, NextResponse } from 'next/server';
import {
  createInstoreOrder,
  agreementToSveaItem,
} from '@/lib/svea/client';

/**
 * POST /api/svea/order
 *
 * Creates a Svea Instore order. Svea sends an SMS to the customer's phone
 * with a payment link. Customer selects financing plan and signs with BankID.
 *
 * Body:
 *   agreementNumber  string   e.g. "AGR-2024-0089"
 *   customerPhone    string   e.g. "+46700000000"
 *   vehicleName      string   e.g. "Kawasaki Ninja ZX-6R 2024"
 *   vin              string   e.g. "JKBZXR636PA012345"
 *   balanceDue       number   amount in SEK (after trade-in, deposit)
 *
 * Response:
 *   orderId          number   Svea internal order ID
 *   status           string   "Created"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agreementNumber, customerPhone, vehicleName, vin, balanceDue } = body;

    if (!agreementNumber || !customerPhone || !vehicleName || !vin || !balanceDue) {
      return NextResponse.json(
        { error: 'Missing required fields: agreementNumber, customerPhone, vehicleName, vin, balanceDue' },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

    // Svea requires a unique MerchantOrderNumber per order.
    // Append a short timestamp suffix so retries and resends always succeed.
    const suffix = Date.now().toString(36).toUpperCase();  // e.g. "M2XQPT"
    const merchantOrderNumber = `${agreementNumber}-${suffix}`;

    const result = await createInstoreOrder({
      merchantOrderNumber,
      customerPhone,
      callbackUri: `${baseUrl}/api/svea/callback`,
      termsUri: `${baseUrl}/terms`,
      items: [
        agreementToSveaItem(vin, vehicleName, balanceDue, 25),
      ],
      minutesUntilLinkExpires: 20,
    });

    // Log full Svea response so you can see every field returned (check terminal)
    console.log('[Svea createInstoreOrder] full response:', JSON.stringify(result, null, 2));

    return NextResponse.json({
      orderId:              result.paymentOrderId,
      status:               result.orderStatus,
      merchantOrderNumber,
      smsSentSuccessfully:  result.smsSentSuccessfully ?? null,
      paymentLink:          result.instoreUiUri ?? null,
    });
  } catch (error: any) {
    console.error('[Svea /api/svea/order]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
