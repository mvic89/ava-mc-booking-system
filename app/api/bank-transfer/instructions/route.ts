import { NextRequest, NextResponse } from 'next/server';
import { generatePaymentInstructions } from '@/lib/bank_transfer/client';

/**
 * POST /api/bank-transfer/instructions — generate bank transfer payment instructions
 * Body: { orderId, amount, currency?, customerName }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, amount, currency, customerName } = body;

    if (!orderId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, amount' },
        { status: 400 },
      );
    }

    const instructions = generatePaymentInstructions({
      orderId,
      amount,
      currency:     currency ?? 'SEK',
      customerName: customerName ?? '',
    });

    return NextResponse.json(instructions);
  } catch (error: any) {
    console.error('[BankTransfer POST instructions]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
