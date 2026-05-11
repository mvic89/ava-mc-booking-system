import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

/**
 * GET /api/invoices?dealershipId=...
 * Fetches all invoices for a dealership using the service-role key,
 * bypassing any RLS policies that would block the anon browser client.
 */
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) {
    return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
  }

  const customerId = req.nextUrl.searchParams.get('customerId');

  let query = sb()
    .from('invoices')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('issue_date', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', Number(customerId));
  }

  const { data, error } = await query;

  if (error) {
    console.error('[api/invoices] fetch error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data ?? [] });
}
