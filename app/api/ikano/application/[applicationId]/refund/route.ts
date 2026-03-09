import { NextRequest, NextResponse } from 'next/server';
import { refundApplication } from '@/lib/ikano/client';

/** POST /api/ikano/application/[applicationId]/refund — Body: { amount, reason? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await params;
    const { amount, reason } = await req.json();
    if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 });

    const result = await refundApplication(applicationId, amount, reason);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Ikano refund]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
