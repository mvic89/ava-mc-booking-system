import { NextRequest, NextResponse } from 'next/server';
import { createInvoice, getInvoice, bookkeepInvoice } from '@/lib/fortnox/client';
import { getCredential } from '@/lib/integrations/config-store';

function getToken(dealerId: string) {
  return getCredential(dealerId, 'fortnox', 'FORTNOX_ACCESS_TOKEN');
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
  try {
    const body = await req.json() as {
      dealerId:        string;
      customerNumber:  string;
      agreementNumber: string;
      vehicle:         string;
      totalAmount:     number;
      vatAmount:       number;
      dueDate?:        string;
    };

    const token = getToken(body.dealerId ?? 'ava-mc');
    if (!token) {
      return NextResponse.json({ error: 'Fortnox access token not configured' }, { status: 400 });
    }

    const today    = new Date();
    const due      = body.dueDate ?? new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
    const netPrice = body.totalAmount - body.vatAmount;
    const vatRate  = Math.round((body.vatAmount / netPrice) * 100 * 100); // basis points → 2500 = 25%

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
          VAT:               vatRate / 100,
        },
      ],
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error: any) {
    console.error('[fortnox/invoice POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
