import { NextRequest, NextResponse } from 'next/server';
import { listTerminals } from '@/lib/adyen/client';

/** GET /api/adyen/terminal/terminals — list all terminals for the merchant account */
export async function GET(_req: NextRequest) {
  try {
    const result = await listTerminals();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Adyen list terminals]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
