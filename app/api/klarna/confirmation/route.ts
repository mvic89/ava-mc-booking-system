// ─── GET /api/klarna/confirmation ─────────────────────────────────────────────
// Klarna redirects to this URL after a redirect-based payment flow completes.
// This is rare in the Klarna Payments widget flow (which is embedded, not redirect),
// but required for some payment categories on mobile.
//
// The `session_id` query param is passed by Klarna on redirect.
// We simply redirect the user to a success page — the actual order has already
// been created via /api/klarna/order from the frontend authorize() callback.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id') ?? '';

  console.log(`[Klarna confirmation] Redirect received, session_id=${sessionId}`);

  // The payment page handles success via the authorize() callback, not this redirect.
  // Redirect the user back to the payment page — they'll see the success state.
  const origin = req.headers.get('origin') ?? '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin ?? 'http://localhost:3000';

  return NextResponse.redirect(`${appUrl}/sales/leads`);
}
