// POST /api/auth/verify-otp
//
// Verifies a 6-digit OTP against the signed token returned by /api/auth/send-otp.
// Timing-safe comparison prevents brute-force enumeration.
//
// Body:    { code: string; token: string; email: string }
// Returns: { valid: true } | { valid: false; error: 'expired' | 'invalid' }

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-otp-secret-change-in-prod';

export async function POST(req: NextRequest) {
  try {
    const { code, token, email } =
      (await req.json()) as { code: string; token: string; email: string };

    if (!code || !token || !email) {
      return NextResponse.json(
        { valid: false, error: 'missing fields' },
        { status: 400 },
      );
    }

    // Token format: {base64url_sig}.{expires_ms}
    const lastDot   = token.lastIndexOf('.');
    const sig       = token.slice(0, lastDot);
    const expiresMs = Number(token.slice(lastDot + 1));

    if (!sig || !expiresMs || isNaN(expiresMs)) {
      return NextResponse.json({ valid: false, error: 'invalid' });
    }

    if (Date.now() > expiresMs) {
      return NextResponse.json({ valid: false, error: 'expired' });
    }

    const expected = createHmac('sha256', SECRET)
      .update(`${code.trim()}:${email.toLowerCase()}:${expiresMs}`)
      .digest('base64url');

    // Timing-safe comparison (both must be the same byte length for base64url)
    let valid = false;
    try {
      const aBuf = Buffer.from(sig,      'base64url');
      const bBuf = Buffer.from(expected, 'base64url');
      valid = aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
    } catch {
      valid = false;
    }

    if (!valid) {
      return NextResponse.json({ valid: false, error: 'invalid' });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error('[verify-otp] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
