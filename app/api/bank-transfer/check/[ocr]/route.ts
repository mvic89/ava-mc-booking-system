import { NextRequest, NextResponse } from 'next/server';
import { checkPaymentReceived, validateOCR } from '@/lib/bank_transfer/client';

/**
 * GET /api/bank-transfer/check/[ocr] — check if a bank transfer has been received for this OCR number
 * In production: query your bank's API or reconciliation service.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ocr: string }> },
) {
  try {
    const { ocr } = await params;

    if (!validateOCR(ocr)) {
      return NextResponse.json({ error: 'Invalid OCR number' }, { status: 400 });
    }

    const result = checkPaymentReceived(ocr);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[BankTransfer GET check]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
