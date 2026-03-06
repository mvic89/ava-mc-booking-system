import { NextRequest, NextResponse } from 'next/server';
import { getTransaction } from '@/lib/bambora/client';

/** GET /api/bambora/transaction/[transactionId] — get transaction details */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  try {
    const { transactionId } = await params;
    const result = await getTransaction(transactionId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Bambora GET transaction]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
