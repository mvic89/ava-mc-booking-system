// ─── GET /api/customers/list?dealershipId=…[&id=…] ────────────────────────────
// Server-side customer reads using the service-role client so Supabase RLS on
// the customers table never blocks the SELECT.
// ?id=<number>  → returns a single customer row
// (no id param) → returns all customers for the dealership, ordered by last_activity desc

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) {
    return NextResponse.json({ customers: [] });
  }

  const idParam = req.nextUrl.searchParams.get('id');

  if (idParam) {
    // Single-customer lookup
    const { data, error } = await sb()
      .from('customers')
      .select('*')
      .eq('id', Number(idParam))
      .eq('dealership_id', dealershipId)
      .single();

    if (error) {
      console.error('[api/customers/list] single:', error.message);
      return NextResponse.json({ customer: null });
    }
    return NextResponse.json({ customer: data });
  }

  // Full list
  const { data, error } = await sb()
    .from('customers')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('last_activity', { ascending: false });

  if (error) {
    console.error('[api/customers/list]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customers = data ?? [];

  // Count paid invoices per customer (proxy for vehicles purchased)
  const customerIds = customers.map((c: any) => c.id);
  const vehicleCountMap: Record<number, number> = {};
  if (customerIds.length > 0) {
    const { data: invoiceRows } = await sb()
      .from('invoices')
      .select('customer_id')
      .in('customer_id', customerIds)
      .eq('status', 'paid')
      .not('vehicle', 'is', null);
    for (const row of (invoiceRows ?? [])) {
      vehicleCountMap[row.customer_id] = (vehicleCountMap[row.customer_id] ?? 0) + 1;
    }
  }

  const enriched = customers.map((c: any) => ({
    ...c,
    vehicle_count: vehicleCountMap[c.id] ?? 0,
  }));

  return NextResponse.json({ customers: enriched });
}
