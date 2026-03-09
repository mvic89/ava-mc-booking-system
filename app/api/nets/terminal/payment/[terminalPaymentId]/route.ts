import { NextRequest, NextResponse } from 'next/server';
import { getTerminalPayment, cancelTerminalPayment } from '@/lib/nets/client';

/** GET /api/nets/terminal/payment/[terminalPaymentId] — get terminal payment status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ terminalPaymentId: string }> },
) {
  try {
    const { terminalPaymentId } = await params;
    const result = await getTerminalPayment(terminalPaymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Nets GET terminal payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE /api/nets/terminal/payment/[terminalPaymentId] — cancel terminal payment */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ terminalPaymentId: string }> },
) {
  try {
    const { terminalPaymentId } = await params;
    await cancelTerminalPayment(terminalPaymentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Nets DELETE terminal payment]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
