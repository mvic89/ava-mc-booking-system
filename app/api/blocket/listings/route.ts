import { NextRequest, NextResponse } from 'next/server';
import { listActiveAds } from '@/lib/blocket/client';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * GET /api/blocket/listings?dealerId=ava-mc
 *
 * Returns all active motorcycle listings for this dealer's Blocket account.
 */
export async function GET(req: NextRequest) {
  try {
    const dealerId = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';

    const apiKey    = await getCredential(dealerId, 'blocket', 'BLOCKET_API_KEY');
    const accountId = await getCredential(dealerId, 'blocket', 'BLOCKET_ACCOUNT_ID');

    if (!apiKey || !accountId) {
      return NextResponse.json({ error: 'Blocket API key and Account ID not configured' }, { status: 400 });
    }

    const ads = await listActiveAds(apiKey, accountId);
    return NextResponse.json({ ads });
  } catch (error: any) {
    // A 404 from Blocket means the account ID is wrong or credentials are
    // placeholders — treat it as "not configured" rather than a server error.
    if (/404/.test(error.message)) {
      console.warn('[blocket/listings GET] Blocket account not found — credentials not configured');
      return NextResponse.json({ ads: [] });
    }
    console.error('[blocket/listings GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
