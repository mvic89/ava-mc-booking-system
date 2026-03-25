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

  return NextResponse.json({ customers: data ?? [] });
}
