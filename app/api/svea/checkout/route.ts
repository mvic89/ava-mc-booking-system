import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutOrder, getAvailableCampaigns, type SveaCheckoutOrderRequest } from '@/lib/svea/client';

/**
 * POST /api/svea/checkout
 *
 * Create a Svea Checkout order.
 * Returns an HTML Snippet to embed the checkout widget on the page.
 * The customer fills in address, selects payment method, and confirms inside the widget.
 *
 * Body: SveaCheckoutOrderRequest
 *   MerchantSettings: { TermsUri, CheckoutUri, ConfirmationUri, PushUri }
 *   Cart: { Items: SveaCheckoutOrderLine[] }
 *   Currency: "SEK", CountryCode: "SE", Locale: "sv-SE"
 *   ClientOrderNumber? (your internal reference)
 *
 * Returns: { orderId, snippet (HTML), status }
 *
 * Svea API: POST /api/orders  (Checkout, HMAC)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/svea/checkout?campaigns=1&isCompany=false&amount=50000
 *
 * Get available part-payment campaigns for the given amount.
 * amount = in SEK (will be converted to öre).
 *
 * Svea API: GET /api/util/GetAvailablePartPaymentCampaigns  (Checkout, HMAC)
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SveaCheckoutOrderRequest;

    if (!body.Cart?.Items?.length) {
      return NextResponse.json({ error: 'Cart.Items is required' }, { status: 400 });
    }

    const order = await createCheckoutOrder(body);
    console.log(`[Svea Checkout] Order created — orderId: ${order.OrderId}, status: ${order.Status}`);
    return NextResponse.json({
      orderId: order.OrderId,
      status:  order.Status,
      snippet: order.Snippet,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Svea checkout POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amountSek        = Number(searchParams.get('amount') ?? '0');
    const isCompany        = searchParams.get('isCompany') === 'true';

    if (!amountSek) {
      return NextResponse.json({ error: 'amount (SEK) query param is required' }, { status: 400 });
    }

    const campaigns = await getAvailableCampaigns(isCompany, Math.round(amountSek * 100));
    console.log(`[Svea Checkout] Campaigns for ${amountSek} SEK — ${campaigns.length} available`);
    return NextResponse.json({ campaigns });
  } catch (error: any) {
    console.error('[Svea checkout GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
