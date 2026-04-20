// GET /api/inventory/list?dealershipId=X
// Returns a minimal list of motorcycles in stock for dropdowns (calendar, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data, error } = await sb
    .from('motorcycles')
    .select('id, name, stock')
    .eq('dealership_id', dealershipId)
    .gt('stock', 0)
    .order('name');

  if (error) {
    // Table may not exist — return empty gracefully
    if (error.code === '42P01' || error.code === 'PGRST205') return NextResponse.json([]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name })));
}
