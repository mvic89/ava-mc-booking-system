// GET /api/cancellations?dealershipId=&status=&from=&to=

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sp           = req.nextUrl.searchParams;
  const dealershipId = sp.get('dealershipId');
  const status       = sp.get('status');
  const from         = sp.get('from');
  const to           = sp.get('to');

  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (getSupabaseAdmin() as any)
    .from('cancellations')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (status) q = q.eq('status', status);
  if (from)   q = q.gte('created_at', from);
  if (to)     q = q.lte('created_at', to + 'T23:59:59Z');

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cancellations: data ?? [] });
}
