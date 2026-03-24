// ─── GET /api/invoice/list?dealershipId=… ──────────────────────────────────────
// Server-side invoice reads using the service-role client so Supabase RLS on
// the invoices table never blocks the SELECT.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) {
    return NextResponse.json({ invoices: [] });
  }

  const { data, error } = await sb()
    .from('invoices')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('issue_date', { ascending: false });

  if (error) {
    console.error('[api/invoice/list]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data ?? [] });
}
