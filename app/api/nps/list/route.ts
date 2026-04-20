// GET /api/nps/list?dealershipId=&from=&to=&responded=true|false

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  const sp           = req.nextUrl.searchParams;
  const dealershipId = sp.get('dealershipId');
  const from         = sp.get('from');
  const to           = sp.get('to');
  const responded    = sp.get('responded');

  if (!dealershipId)
    return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb()
    .from('nps_surveys')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('sent_at', { ascending: false })
    .limit(200);

  if (from) q = q.gte('sent_at', from);
  if (to)   q = q.lte('sent_at', to + 'T23:59:59Z');
  if (responded === 'true')  q = q.not('responded_at', 'is', null);
  if (responded === 'false') q = q.is('responded_at', null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ surveys: data ?? [] });
}
