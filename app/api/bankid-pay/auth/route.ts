import { NextRequest, NextResponse } from 'next/server';
import { initiateAuth } from '@/lib/bankid_pay/client';

/**
 * POST /api/bankid-pay/auth — start BankID payment authentication
 * Body: { personalNumber?, endUserIp }
 */
export async function POST(req: NextRequest) {
  try {
    const { personalNumber, endUserIp } = await req.json();
    const ip = endUserIp ?? req.headers.get('x-forwarded-for') ?? '127.0.0.1';

    const result = await initiateAuth({ personalNumber, endUserIp: ip });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[BankID Pay auth]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
