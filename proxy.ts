/**
 * Next.js 16 proxy (replaces middleware.ts)
 *
 * Runs on every request.  Responsibilities:
 *   1. i18n — locale is handled via cookies (no URL segments), so this just passes through
 *   2. Auth guard — every page and API route is protected unless it is in PUBLIC_PREFIXES
 *
 * Protected by an httpOnly session cookie `ava_session` set server-side
 * by POST /api/auth/session after login.  Because the cookie is httpOnly,
 * JavaScript cannot read or forge it.
 *
 * Public paths (no session required):
 *   /auth/*             — login, signup, password reset
 *   /privacy, /terms    — public legal pages
 *   /api/bankid/*       — BankID handshake (called before session exists)
 *   /api/bankid-pay/*   — BankID payment (initiated from the payment page)
 *   /api/auth/session   — the session create/destroy endpoint itself
 */

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/auth/',
  '/privacy',
  '/terms',
  '/api/bankid/',
  '/api/bankid-pay/',
  '/api/auth/session',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/login',
  '/api/webhooks/',     // Postmark inbound webhook — no session needed
  '/api/cron/',         // Vercel cron jobs — protected by CRON_SECRET header
  '/api/goods-receipt',       // Called internally by webhooks — protected by x-webhook-secret
  '/api/notifications/add',   // Called internally by webhooks — protected by x-webhook-secret
];

const COOKIE_NAME = 'ava_session';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths and static assets (images, fonts, etc. in /public)
  const isStaticAsset = /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|mp4|pdf)$/i.test(pathname);
  const isPublic =
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === '/' ||
    pathname === '/favicon.ico' ||
    isStaticAsset;

  if (isPublic) return NextResponse.next();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const session = request.cookies.get(COOKIE_NAME);

  if (!session?.value) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate session payload (check expiry)
  try {
    const payload = JSON.parse(
      Buffer.from(session.value, 'base64url').toString('utf-8'),
    );
    const isPlatformAdmin = payload?.role === 'platform_admin';
    if ((!isPlatformAdmin && !payload?.dealershipId) || payload.exp < Date.now()) {
      const response = NextResponse.redirect(new URL('/auth/login', request.url));
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  } catch {
    // Corrupt cookie — clear and redirect
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Run on every request except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};