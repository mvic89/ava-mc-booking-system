// GET /api/fortnox/oauth/callback?code=...&state=dealershipId
//
// Fortnox redirects here after the admin approves the OAuth connection.
// We exchange the authorization code for access + refresh tokens and
// persist them in data/integration-configs.json via the config store.
// Finally, we redirect the admin to /accounting?connected=true.

import { NextRequest, NextResponse } from 'next/server';
import {
  getCredential,
  getStoredConfig,
  initDealerConfig,
  saveStoredConfig,
} from '@/lib/integrations/config-store';

const FORTNOX_TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token';

export async function GET(req: NextRequest) {
  const code         = req.nextUrl.searchParams.get('code');
  const dealershipId = req.nextUrl.searchParams.get('state') ?? '';
  const error        = req.nextUrl.searchParams.get('error');

  // User denied or Fortnox returned an error
  if (error || !code || !dealershipId) {
    const reason = error ?? 'missing_code';
    return NextResponse.redirect(
      new URL(`/accounting?error=${encodeURIComponent(reason)}`, req.url),
    );
  }

  // Retrieve client credentials
  const clientId     = getCredential(dealershipId, 'fortnox', 'FORTNOX_CLIENT_ID');
  const clientSecret = getCredential(dealershipId, 'fortnox', 'FORTNOX_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/accounting?error=missing_client_credentials', req.url),
    );
  }

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`;
  const redirectUri = `${appUrl}/api/fortnox/oauth/callback`;

  try {
    // Exchange authorization code for tokens
    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const encoded  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(FORTNOX_TOKEN_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${encoded}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('[fortnox/callback] token exchange failed:', tokenRes.status, text);
      return NextResponse.redirect(
        new URL(`/accounting?error=${encodeURIComponent('token_exchange_failed')}`, req.url),
      );
    }

    const tokens = await tokenRes.json() as {
      access_token:  string;
      refresh_token: string;
      expires_in:    number;
    };

    // Persist tokens in the config store
    const cfg = getStoredConfig(dealershipId) ?? initDealerConfig(dealershipId, dealershipId);
    cfg.credentials.fortnox = {
      ...cfg.credentials.fortnox,
      FORTNOX_ACCESS_TOKEN:     tokens.access_token,
      FORTNOX_REFRESH_TOKEN:    tokens.refresh_token,
      FORTNOX_TOKEN_EXPIRES_AT: String(Date.now() + tokens.expires_in * 1_000),
    };
    saveStoredConfig(cfg);

    return NextResponse.redirect(new URL('/accounting?connected=true', req.url));

  } catch (err) {
    console.error('[fortnox/callback] unexpected error:', err);
    return NextResponse.redirect(
      new URL('/accounting?error=unexpected', req.url),
    );
  }
}
