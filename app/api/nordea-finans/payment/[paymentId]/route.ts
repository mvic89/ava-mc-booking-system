import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/nordea_finans/client';

/** GET /api/nordea-finans/payment/[paymentId]?access_token=xxx */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId }  = await params;
    const access_token   = req.nextUrl.searchParams.get('access_token') ?? '';
    if (!access_token) return NextResponse.json({ error: 'access_token is required' }, { status: 400 });

    const result = await getPayment(access_token, paymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Nordea GET payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
