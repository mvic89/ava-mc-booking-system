import { NextRequest, NextResponse } from 'next/server';
import { initiateTerminalPayment } from '@/lib/adyen/client';

/**
 * POST /api/adyen/terminal/payment — send NEXO cloud payment to a terminal
 * Body: { terminalId, serviceId, amount, currency? }
 */
export async function POST(req: NextRequest) {
  try {
    const { terminalId, serviceId, amount, currency } = await req.json();

    if (!terminalId || !serviceId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: terminalId, serviceId, amount' },
        { status: 400 },
      );
    }

    const result = await initiateTerminalPayment({ terminalId, serviceId, amount, currency: currency ?? 'SEK' });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Adyen terminal payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
