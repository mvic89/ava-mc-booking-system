import { NextRequest, NextResponse } from 'next/server';
import { refundApplication } from '@/lib/santander/client';

/** POST /api/santander/application/[applicationId]/refund — Body: { amount, reason? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await params;
    const { amount, reason } = await req.json();
    if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 });

    const result = await refundApplication({ applicationId, amount, reason });
    console.log(`[Santander] Refund ${result.refundId} status: ${result.status}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Santander refund]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
