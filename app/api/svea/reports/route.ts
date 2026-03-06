import { NextRequest, NextResponse } from 'next/server';
import { getReport } from '@/lib/svea/client';

/**
 * GET /api/svea/reports?date=2024-06-15&includeWithholding=false
 *
 * Get the payout/reconciliation report for a specific date.
 * Returns per-transaction data: OrderId, Amount, PayoutDate, PaymentType, ClientOrderNumber.
 * Use for daily accounting reconciliation and Fortnox export.
 *
 * Query params:
 *   date               — ISO 8601 date (required), e.g. "2024-06-15"
 *   includeWithholding — "true" | "false" (optional, default false)
 *
 * Svea API: GET /api/v2/reports?date={date}&includeWithholding={bool}  (Admin, HMAC)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams }    = new URL(req.url);
    const date                = searchParams.get('date');
    const includeWithholding  = searchParams.get('includeWithholding') === 'true';

    if (!date) {
      return NextResponse.json({ error: 'date query param is required (ISO 8601, e.g. 2024-06-15)' }, { status: 400 });
    }

    const report = await getReport(date, includeWithholding);
    console.log(`[Svea] Report for ${date} — ${report.Rows?.length ?? 0} row(s), total: ${report.TotalAmount}`);
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[Svea reports]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
