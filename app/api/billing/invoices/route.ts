// GET /api/billing/invoices?dealershipId=…
// Returns real Stripe invoices for the dealership's customer.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BASE = 'https://api.stripe.com/v1';
const SK   = process.env.STRIPE_SECRET_KEY ?? '';

async function stripe<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${SK}`, 'Stripe-Version': '2024-06-20' },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message: string } };
    throw new Error(e.error?.message ?? `Stripe ${res.status}`);
  }
  return res.json() as T;
}

interface StripeInvoice {
  id:               string;
  number:           string | null;
  status:           string;
  amount_paid:      number;
  amount_due:       number;
  currency:         string;
  created:          number;
  invoice_pdf:      string | null;
  hosted_invoice_url: string | null;
  period_start:     number;
  period_end:       number;
}

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
  if (!SK) return NextResponse.json({ invoices: [] });

  const sb = getSupabaseAdmin();
  const { data: dealer } = await sb
    .from('dealerships')
    .select('stripe_customer_id')
    .eq('id', dealershipId)
    .maybeSingle();

  const customerId = (dealer as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ invoices: [] });

  try {
    const list = await stripe<{ data: StripeInvoice[] }>(
      `/invoices?customer=${customerId}&limit=24&status=paid`,
    );
    return NextResponse.json({
      invoices: list.data.map(inv => ({
        id:          inv.id,
        number:      inv.number ?? inv.id,
        status:      inv.status,
        amount:      inv.amount_paid / 100, // convert from minor units
        currency:    inv.currency.toUpperCase(),
        date:        new Date(inv.created * 1000).toISOString(),
        pdfUrl:      inv.invoice_pdf,
        portalUrl:   inv.hosted_invoice_url,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
