// GET /api/fortnox/oauth/authorize?dealershipId=xxx
//
// Redirects the admin browser to the Fortnox OAuth authorization page.
// The dealershipId is passed as `state` so the callback knows which dealer
// to store the tokens for.
//
// Prerequisites (configured in Settings → Integrations → Fortnox):
//   FORTNOX_CLIENT_ID      — obtained from developer.fortnox.se
//   FORTNOX_CLIENT_SECRET  — same

import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/integrations/config-store';

const FORTNOX_AUTH_URL = 'https://apps.fortnox.se/oauth-v1/auth';
const SCOPES           = 'invoice customer companyinformation';

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId') ?? '';
  if (!dealershipId) {
    return NextResponse.json({ error: 'dealershipId is required' }, { status: 400 });
  }

  const clientId = getCredential(dealershipId, 'fortnox', 'FORTNOX_CLIENT_ID');
  if (!clientId) {
    return NextResponse.json(
      { error: 'FORTNOX_CLIENT_ID is not configured. Go to Settings → Integrations → Fortnox.' },
      { status: 400 },
    );
  }

  // Build the redirect URI — must match exactly what's registered in the Fortnox developer portal
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`;
  const redirectUri = `${appUrl}/api/fortnox/oauth/callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         SCOPES,
    state:         dealershipId,          // carried through OAuth round-trip
    response_type: 'code',
    access_type:   'offline',             // request a refresh token
  });

  return NextResponse.redirect(`${FORTNOX_AUTH_URL}?${params.toString()}`);
}
