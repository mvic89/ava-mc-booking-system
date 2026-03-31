// POST /api/auth/send-otp
//
// Generates a 6-digit OTP, HMAC-signs it with an expiry, and sends it to the
// provided email address via Resend.
//
// Body:  { email: string; name?: string }
// Returns: { token: string }   — opaque signed token, safe to store client-side
//
// Dev fallback: if Resend fails, OTP is logged to the server console so you
// can still test the flow without a verified sender domain.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomInt } from 'crypto';
import { Resend } from 'resend';
import React from 'react';
import { VerifyEmail } from '@/components/emails/VerifyEmail';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? 'BikeMeNow <noreply@contact.bikeme.now>';

// HMAC secret — re-uses the service-role key which is server-only
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-otp-secret-change-in-prod';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function makeToken(code: string, email: string, expires: number): string {
  const sig = createHmac('sha256', SECRET)
    .update(`${code}:${email.toLowerCase()}:${expires}`)
    .digest('base64url');
  return `${sig}.${expires}`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, name } = (await req.json()) as { email: string; name?: string };

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const code    = String(randomInt(100000, 1000000));
    const expires = Date.now() + TTL_MS;
    const token   = makeToken(code, email, expires);

    // ── Attempt to send via Resend ───────────────────────────────────────────
    let emailSent = false;
    let sendError: string | null = null;

    try {
      const { error: mailErr } = await resend.emails.send({
        from:    FROM_ADDRESS,
        to:      [email],
        subject: `${code} — din BikeMeNow-verifieringskod`,
        react:   React.createElement(VerifyEmail, {
          code,
          name: name?.trim() || email,
        }),
      });

      if (mailErr) {
        sendError = typeof mailErr === 'object' && mailErr !== null && 'message' in mailErr
          ? String((mailErr as { message: unknown }).message)
          : JSON.stringify(mailErr);
        console.error('[send-otp] Resend error:', sendError);
      } else {
        emailSent = true;
      }
    } catch (mailException) {
      sendError = String(mailException);
      console.error('[send-otp] Resend exception:', mailException);
    }

    // ── Dev fallback: log code to console so the flow stays testable ─────────
    if (!emailSent) {
      const isDev = process.env.NODE_ENV === 'development';
      console.warn(
        isDev
          ? `\n\n  [OTP DEV FALLBACK]\n  To: ${email}\n  Code: ${code}\n  (Email send failed: ${sendError})\n`
          : `[send-otp] production email failed for ${email}: ${sendError}`,
      );

      // In production, refuse to continue silently — surface the error
      if (!isDev) {
        return NextResponse.json(
          { error: `Email delivery failed: ${sendError}` },
          { status: 500 },
        );
      }
      // In development: still return the token so the flow can be tested via console
    }

    return NextResponse.json({ token, ...(process.env.NODE_ENV === 'development' && !emailSent ? { devCode: code } : {}) });
  } catch (err) {
    console.error('[send-otp] unexpected error:', err);
    return NextResponse.json({ error: `Internal server error: ${String(err)}` }, { status: 500 });
  }
}
