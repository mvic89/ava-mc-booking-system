import { NextRequest, NextResponse } from 'next/server';
import { cancelOrder } from '@/lib/bankid_pay/client';

/** POST /api/bankid-pay/cancel — Body: { orderRef } */
export async function POST(req: NextRequest) {
  try {
    const { orderRef } = await req.json();
    if (!orderRef) return NextResponse.json({ error: 'orderRef is required' }, { status: 400 });

    await cancelOrder(orderRef);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[BankID Pay cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
