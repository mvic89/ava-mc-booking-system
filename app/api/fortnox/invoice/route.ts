import { NextRequest, NextResponse } from 'next/server';
import { createInvoice, getInvoice, bookkeepInvoice } from '@/lib/fortnox/client';
import { getCredential } from '@/lib/integrations/config-store';

function getToken(dealerId: string) {
  return await getCredential(dealerId, 'fortnox', 'FORTNOX_ACCESS_TOKEN');
}

/**
 * POST /api/fortnox/invoice
 *
 * Create a Fortnox invoice after a signed purchase agreement.
 *
 * Body: {
 *   dealerId:          string
 *   customerNumber:    string           ← Fortnox customer number
 *   agreementNumber:   string           ← e.g. AGR-2024-0089
 *   vehicle:           string           ← e.g. Kawasaki Ninja ZX-6R 2024
 *   totalAmount:       number           ← SEK incl. VAT
 *   vatAmount:         number           ← SEK VAT amount
 *   dueDate?:          string           ← ISO date (default: 30 days)
 * }
 */
export async function POST(req: NextRequest) {
  let body: {
    dealerId:        string;
    customerNumber:  string;
    agreementNumber: string;
    vehicle:         string;
    totalAmount:     number;
    vatAmount:       number;
    dueDate?:        string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = getToken(body.dealerId ?? 'ava-mc');
  if (!token) {
    return NextResponse.json({ skipped: true, reason: 'Fortnox not configured' });
  }

  try {
    const today    = new Date();
    const due      = body.dueDate ?? new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
    const netPrice = body.totalAmount - body.vatAmount;
    const vatRate  = netPrice > 0 ? Math.round((body.vatAmount / netPrice) * 100) : 25;

    const invoice = await createInvoice(token, {
      CustomerNumber: body.customerNumber,
      InvoiceDate:    today.toISOString().slice(0, 10),
      DueDate:        due,
      YourReference:  body.agreementNumber,
      Remarks:        `Köpeavtal ${body.agreementNumber}`,
      Currency:       'SEK',
      Language:       'SV',
      InvoiceRows: [
        {
          Description:       body.vehicle,
          DeliveredQuantity: 1,
          Price:             netPrice,
          VAT:               vatRate,
        },
      ],
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[fortnox/invoice POST] Fortnox API error (integration skipped):', msg);
    return NextResponse.json({ skipped: true, reason: msg }, { status: 502 });
  }
}

/**
 * GET /api/fortnox/invoice/[invoiceNumber]
 * Moved to app/api/fortnox/invoice/[invoiceNumber]/route.ts
 * This handler supports ?invoiceNumber= as a query param fallback.
 */
export async function GET(req: NextRequest) {
  const dealerId      = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';
  const invoiceNumber = req.nextUrl.searchParams.get('invoiceNumber');
  if (!invoiceNumber) {
    return NextResponse.json({ error: 'invoiceNumber required' }, { status: 400 });
  }
  const token = getToken(dealerId);
  if (!token) {
    return NextResponse.json({ error: 'Fortnox access token not configured' }, { status: 400 });
  }
  try {
    const invoice = await getInvoice(token, invoiceNumber);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
