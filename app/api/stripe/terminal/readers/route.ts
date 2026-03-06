import { NextRequest, NextResponse } from 'next/server';
import { listTerminalReaders } from '@/lib/stripe/client';

/** GET /api/stripe/terminal/readers — list registered Terminal readers */
export async function GET(_req: NextRequest) {
  try {
    const result = await listTerminalReaders();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Stripe list readers]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
