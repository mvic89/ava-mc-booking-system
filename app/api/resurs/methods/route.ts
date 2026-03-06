import { NextRequest, NextResponse } from 'next/server';
import { getPaymentMethods } from '@/lib/resurs/client';

/** GET /api/resurs/methods?storeId=xxx&amount=50000 */
export async function GET(req: NextRequest) {
  try {
    const storeId = req.nextUrl.searchParams.get('storeId') ?? '';
    const amount  = Number(req.nextUrl.searchParams.get('amount') ?? 0);
    const methods = await getPaymentMethods(storeId, { amount, customerType: 'NATURAL' });
    return NextResponse.json(methods);
  } catch (error: any) {
    console.error('[Resurs methods]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
