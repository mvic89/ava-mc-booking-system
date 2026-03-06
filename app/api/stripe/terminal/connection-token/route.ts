import { NextRequest, NextResponse } from 'next/server';
import { createTerminalConnectionToken } from '@/lib/stripe/client';

/** POST /api/stripe/terminal/connection-token — for Stripe Terminal SDK */
export async function POST(_req: NextRequest) {
  try {
    const result = await createTerminalConnectionToken();
    return NextResponse.json({ secret: result.secret });
  } catch (error: any) {
    console.error('[Stripe terminal connection-token]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
