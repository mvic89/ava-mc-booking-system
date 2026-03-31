// POST /api/fortnox/sync
//
// Triggers a Fortnox sync for one or more paid invoices.
// Called by the /accounting page "Exportera" buttons and the
// fire-and-forget auto-sync in /api/invoice/create.
//
// Body: {
//   dealershipId: string
//   invoiceIds?:  string[]   // omit to sync ALL paid + unsynced invoices
// }

import { NextRequest, NextResponse } from 'next/server';
import { syncInvoicesToFortnox } from '@/lib/fortnox/sync';
import { logAudit }              from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealershipId: string;
      invoiceIds?:  string[];
    };

    const { dealershipId, invoiceIds } = body;

    if (!dealershipId) {
      return NextResponse.json({ error: 'dealershipId is required' }, { status: 400 });
    }

    const result = await syncInvoicesToFortnox(dealershipId, invoiceIds);

    logAudit({
      action:       'FORTNOX_SYNC',
      entity:       'invoice',
      details:      {
        synced:     result.synced,
        failed:     result.failed,
        invoice_ids: invoiceIds ?? 'all',
      },
      dealershipId,
    });

    return NextResponse.json({ ok: true, ...result });

  } catch (err) {
    console.error('[fortnox/sync] unexpected error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
