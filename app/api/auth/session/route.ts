/**
 * Session management API
 *
 * POST   — creates an httpOnly session cookie after successful login
 * GET    — returns the current session payload (for server components / SSR)
 * DELETE — destroys the session (sign out)
 *
 * The cookie is:
 *   - httpOnly  → JavaScript cannot read or steal it (XSS protection)
 *   - Secure    → sent only over HTTPS in production
 *   - SameSite=Strict → CSRF protection
 *   - 8-hour expiry  → short-lived; refresh on activity (future work)
 *
 * The payload contains NO secrets — just identifiers (dealershipId, role).
 * Real data security is enforced by the Supabase queries that always
 * filter .eq('dealership_id', dealershipId).
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'ava_session';
const SESSION_TTL  = 60 * 60 * 8; // 8 hours in seconds

export interface SessionPayload {
  dealershipId: string | undefined;
  dealershipName: string;
  name:         string;
  email:        string;
  role:         'admin' | 'sales' | 'service' | 'platform_admin';
  exp:          number; // Unix ms timestamp
}

// ── POST /api/auth/session — create session ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<SessionPayload>;

    // platform_admin has no dealership — only role is required for them
    const isPlatformAdmin = body.role === 'platform_admin';
    if (!body.role || (!isPlatformAdmin && !body.dealershipId)) {
      return NextResponse.json(
        { error: 'dealershipId and role are required' },
        { status: 400 },
      );
    }

    const payload: SessionPayload = {
      dealershipId:   body.dealershipId,
      dealershipName: body.dealershipName ?? '',
      name:           body.name           ?? '',
      email:          body.email          ?? '',
      role:           body.role,
      exp:            Date.now() + SESSION_TTL * 1000,
    };

    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   SESSION_TTL,
      path:     '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
  }
}

// ── GET /api/auth/session — read current session ──────────────────────────────

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return NextResponse.json(null);

  try {
    const payload = JSON.parse(
      Buffer.from(cookie.value, 'base64url').toString('utf-8'),
    ) as SessionPayload;

    if (payload.exp < Date.now()) {
      const res = NextResponse.json(null);
      res.cookies.delete(COOKIE_NAME);
      return res;
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(null);
  }
}

// ── DELETE /api/auth/session — sign out ───────────────────────────────────────

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   0, // immediate expiry
    path:     '/',
  });
  return res;
}
