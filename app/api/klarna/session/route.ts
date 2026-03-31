import { NextRequest, NextResponse } from 'next/server';
import { createKlarnaSession, type KlarnaOrderLine } from '@/lib/klarna/client';

/**
 * POST /api/klarna/session
 *
 * Creates a Klarna payment session for an agreement.
 * Returns client_token (passed to the Klarna JS SDK on the frontend)
 * and payment_method_categories (the plans Klarna makes available,
 * e.g. "pay_later", "pay_over_time", "pay_now").
 *
 * The frontend uses client_token to initialise Klarna.Payments and
 * display the embedded Klarna widget.
 *
 * Amounts are in minor units — SEK uses öre (100 öre = 1 kr).
 * Tax: Sweden standard VAT = 25 %.
 *   tax_rate field = 2500 (meaning 25.00 %)
 *   tax included in unit_price → total_tax_amount = total × (vat / (100 + vat))
 *     = total × (25/125) = total × 0.2
 */
export async function POST(req: NextRequest) {
  try {
    const { agreementNumber, vehicle, balanceDue } = await req.json() as {
      agreementNumber: string;
      vehicle:         string;
      balanceDue:      number;   // in SEK (whole number)
    };

    // Convert kr → öre (minor units)
    const amountMinor = Math.round(balanceDue * 100);

    // 25 % VAT included — tax = gross × 0.2
    const taxMinor = Math.round(amountMinor * 0.2);

    const orderLines: KlarnaOrderLine[] = [
      {
        type:             'physical',
        name:             vehicle,
        quantity:         1,
        unit_price:       amountMinor,
        total_amount:     amountMinor,
        tax_rate:         2500,         // 25.00 %
        total_tax_amount: taxMinor,
        reference:        agreementNumber,
      },
    ];

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

    const session = await createKlarnaSession({
      purchase_country:    'SE',
      purchase_currency:   'SEK',
      locale:              'sv-SE',
      order_amount:        amountMinor,
      order_tax_amount:    taxMinor,
      order_lines:         orderLines,
      merchant_reference1: agreementNumber,
      // Klarna calls notification when a PENDING fraud-review order is later approved/rejected.
      // confirmation is where Klarna redirects after a redirect-based payment (rare in widget flow).
      merchant_urls: {
        confirmation: `${appUrl}/api/klarna/confirmation`,
        notification: `${appUrl}/api/klarna/notification`,
      },
    });

    console.log(`[Klarna] Session created — session_id: ${session.session_id}`);

    return NextResponse.json({
      session_id:                session.session_id,
      client_token:              session.client_token,
      payment_method_categories: session.payment_method_categories,
    });
  } catch (error: any) {
    console.error('[Klarna session]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
