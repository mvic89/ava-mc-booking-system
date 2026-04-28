// ─── GET /api/agreements/list ──────────────────────────────────────────────────
// Returns all agreements for a dealership using the service-role key.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) {
    return NextResponse.json({ agreements: [] });
  }

  const { data, error } = await sb()
    .from('agreements')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/agreements/list]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agreements: data ?? [] });
}
