import { NextRequest, NextResponse } from 'next/server';
import { bindPolicyLF } from '@/lib/insurance/client';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * POST /api/insurance/bind
 *
 * Bind an insurance policy from a previously obtained quote.
 *
 * Body: {
 *   dealerId:    string
 *   provider:    'lansforsakringar' | 'trygg_hansa'
 *   quoteId:     string
 *   customerSSN: string   ← YYYYMMDDXXXX
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealerId:    string;
      provider:    string;
      quoteId:     string;
      customerSSN: string;
    };

    const dealerId = body.dealerId ?? 'ava-mc';

    if (body.provider === 'lansforsakringar') {
      const apiKey    = getCredential(dealerId, 'lansforsakringar', 'LF_API_KEY');
      const partnerId = getCredential(dealerId, 'lansforsakringar', 'LF_PARTNER_ID');
      const apiUrl    = getCredential(dealerId, 'lansforsakringar', 'LF_API_URL') || 'https://api.lansforsakringar.se/partner/v1';

      if (!apiKey || !partnerId) {
        return NextResponse.json({ error: 'Länsförsäkringar credentials not configured' }, { status: 400 });
      }

      const policy = await bindPolicyLF(apiKey, partnerId, apiUrl, body.quoteId, body.customerSSN);
      return NextResponse.json({ policy });
    }

    return NextResponse.json({ error: `Provider ${body.provider} bind not yet implemented` }, { status: 400 });
  } catch (error: any) {
    console.error('[insurance/bind POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
