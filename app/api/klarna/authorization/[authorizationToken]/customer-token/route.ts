import { NextRequest, NextResponse } from 'next/server';
import { createKlarnaCustomerToken, type KlarnaCustomerTokenRequest } from '@/lib/klarna/client';

/**
 * POST /api/klarna/authorization/[authorizationToken]/customer-token
 *
 * Generate a reusable Klarna customer token for subscriptions or recurring payments.
 * Must be called with a valid authorization_token obtained from Klarna.Payments.authorize().
 *
 * Body: KlarnaCustomerTokenRequest
 *   purchase_country   string   'SE'
 *   purchase_currency  string   'SEK'
 *   locale             string   'sv-SE'
 *   description?       string   e.g. 'Motorcykel AGR-2024-0089'
 *   intended_use?      string   'SUBSCRIPTION' | 'RECURRING' | 'UNSCHEDULED'
 *   billing_address?   object
 *
 * Returns: { token_id, redirect_url?, payment_method_type? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ authorizationToken: string }> },
) {
  try {
    const { authorizationToken } = await params;
    const body = await req.json() as KlarnaCustomerTokenRequest;

    if (!body.purchase_country || !body.purchase_currency || !body.locale) {
      return NextResponse.json(
        { error: 'Missing required fields: purchase_country, purchase_currency, locale' },
        { status: 400 },
      );
    }

    const result = await createKlarnaCustomerToken(authorizationToken, body);
    console.log(`[Klarna] Customer token created — token_id: ${result.token_id}`);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Klarna POST customer-token]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
