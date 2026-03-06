import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/nordea_finans/client';

/** POST /api/nordea-finans/auth/token — Body: { code, redirectUri } */
export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri } = await req.json();
    if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });

    const tokens = await exchangeCodeForToken(
      code,
      redirectUri ?? `${process.env.NEXT_PUBLIC_BASE_URL}/api/nordea-finans/auth/token`,
    );

    console.log('[Nordea] Token exchanged successfully');
    // Return access_token to the caller — they must store it securely (session/DB)
    return NextResponse.json({ access_token: tokens.access_token, expires_in: tokens.expires_in });
  } catch (error: any) {
    console.error('[Nordea auth token]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
