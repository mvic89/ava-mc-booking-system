import { NextRequest, NextResponse } from 'next/server';
import { getRefund } from '@/lib/swish/client';

/** GET /api/swish/refund/[refundId] — check refund status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ refundId: string }> },
) {
  try {
    const { refundId } = await params;
    const result = await getRefund(refundId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Swish GET refund]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
