import { NextRequest, NextResponse } from 'next/server';
import { collectOrder } from '@/lib/bankid_pay/client';

/**
 * POST /api/bankid-pay/collect — poll BankID order status
 * Body: { orderRef }
 */
export async function POST(req: NextRequest) {
  try {
    const { orderRef } = await req.json();
    if (!orderRef) return NextResponse.json({ error: 'orderRef is required' }, { status: 400 });

    const result = await collectOrder(orderRef);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[BankID Pay collect]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
