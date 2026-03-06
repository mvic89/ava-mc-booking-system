import { NextRequest, NextResponse } from 'next/server';
import { refundTransaction } from '@/lib/bambora/client';

/** POST /api/bambora/transaction/[transactionId]/refund — Body: { amount } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  try {
    const { transactionId } = await params;
    const { amount } = await req.json();
    if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 });

    const result = await refundTransaction(transactionId, amount);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Bambora refund]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
