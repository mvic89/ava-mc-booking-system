import { NextRequest, NextResponse } from 'next/server';
import { initiateSign } from '@/lib/bankid_pay/client';

/**
 * POST /api/bankid-pay/sign — initiate BankID signing for a payment
 * Body: { personalNumber?, endUserIp, userVisibleData, userNonVisibleData? }
 */
export async function POST(req: NextRequest) {
  try {
    const { personalNumber, endUserIp, userVisibleData, userNonVisibleData } = await req.json();
    const ip = endUserIp ?? req.headers.get('x-forwarded-for') ?? '127.0.0.1';

    if (!userVisibleData) {
      return NextResponse.json({ error: 'userVisibleData is required' }, { status: 400 });
    }

    const result = await initiateSign({ personalNumber, endUserIp: ip, userVisibleData, userNonVisibleData });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[BankID Pay sign]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
