import { NextRequest, NextResponse } from 'next/server';
import { cancelTransaction } from '@/lib/bambora/client';

/** POST /api/bambora/transaction/[transactionId]/cancel */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  try {
    const { transactionId } = await params;
    await cancelTransaction(transactionId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Bambora cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
