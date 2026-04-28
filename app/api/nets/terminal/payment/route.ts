import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/payments/config-store';
import type { NetsOrderItem } from '@/lib/nets/client';

/**
 * POST /api/nets/terminal/payment — initiate AXEPT terminal (in-store) payment
 *
 * Body: { amount, currency?, reference, orderItems, dealerId? }
 *
 * Credentials are resolved at request time from the config store (no server
 * restart required after saving credentials in Settings → Payment Providers).
 *
 * Note: AXEPT terminal requires NETS_SECRET_KEY + NETS_MERCHANT_ID.
 * Ensure your Nets merchant account has AXEPT terminal enabled.
 */
export async function POST(req: NextRequest) {
  try {
    const { amount, currency, reference, orderItems, dealerId = 'ava-mc' } = await req.json() as {
      amount:     number;
      currency?:  string;
      reference:  string;
      orderItems: NetsOrderItem[];
      dealerId?:  string;
    };

    if (!amount || !reference || !orderItems) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, reference, orderItems' },
        { status: 400 },
      );
    }

    // Read credentials at request time so settings-saved values work immediately
    const secretKey  = await getCredential(dealerId, 'nets', 'NETS_SECRET_KEY');
    const merchantId = await getCredential(dealerId, 'nets', 'NETS_MERCHANT_ID');
    const baseUrl    = await getCredential(dealerId, 'nets', 'NETS_API_URL')
                    || process.env.NETS_API_URL
                    || 'https://test.api.dibspayment.eu';

    if (!secretKey) {
      return NextResponse.json(
        { error: 'Nets secret key is not configured — add NETS_SECRET_KEY in Settings → Payment Providers' },
        { status: 503 },
      );
    }

    const res = await fetch(`${baseUrl}/v1/terminal/payments`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  secretKey,   // raw key, no Bearer prefix
      },
      body: JSON.stringify({
        amount,
        currency:   currency ?? 'SEK',
        reference,
        orderItems,
        merchantId,
      }),
    });

    const body = await res.text();

    if (!res.ok) {
      console.error(`[Nets terminal payment] Nets ${res.status} ${res.statusText}: ${body}`);

      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'Nets authentication failed — check your secret key in Settings → Payment Providers' },
          { status: 401 },
        );
      }
      if (res.status === 404) {
        return NextResponse.json(
          { error: 'Nets AXEPT terminal endpoint not found — ensure your merchant account has AXEPT terminal enabled (contact Nets support)' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: `Nets ${res.status}: ${body}` },
        { status: res.status },
      );
    }

    const result = body ? JSON.parse(body) : {};
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Nets terminal payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
