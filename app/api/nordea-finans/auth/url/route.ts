import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/lib/nordea_finans/client';

/** GET /api/nordea-finans/auth/url?redirectUri=xxx&state=xxx */
export async function GET(req: NextRequest) {
  try {
    const redirectUri = req.nextUrl.searchParams.get('redirectUri') ?? `${process.env.NEXT_PUBLIC_BASE_URL}/api/nordea-finans/auth/token`;
    const state       = req.nextUrl.searchParams.get('state') ?? crypto.randomUUID();
    const url         = buildAuthorizeUrl(redirectUri, state);
    return NextResponse.json({ url, state });
  } catch (error: any) {
    console.error('[Nordea auth url]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
