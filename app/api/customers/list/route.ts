// ─── GET /api/customers/list?dealershipId=…[&id=…] ────────────────────────────
// Server-side customer reads using the service-role client so Supabase RLS on
// the customers table never blocks the SELECT.
// ?id=<number>  → returns a single customer row
// (no id param) → returns all customers for the dealership, ordered by last_activity desc
// On first load (count=0) seeds the 474 INITIAL_CUSTOMERS for this dealership.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { INITIAL_CUSTOMERS, mapCustomerToDb } from '@/lib/customers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// Seed once per dealership (server-side, service-role — bypasses RLS).
async function seedIfEmpty(dealershipId: string): Promise<void> {
  const { count } = await sb()
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('dealership_id', dealershipId);
  if ((count ?? 0) > 0) return;
  const rows = INITIAL_CUSTOMERS.map(c => ({
    ...mapCustomerToDb(c, false),
    dealership_id: dealershipId,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await sb().from('customers').insert(rows.slice(i, i + 100));
    if (error) { console.error('[api/customers/list] seed batch error:', error.message); return; }
  }
  console.log(`[api/customers/list] seeded ${rows.length} initial customers for ${dealershipId}`);
}

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

  // Seed on first visit if this dealership has no customers yet
  await seedIfEmpty(dealershipId);

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

  return NextResponse.json({ customers: data ?? [] });
}
