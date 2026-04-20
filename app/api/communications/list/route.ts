// GET /api/communications/list?dealershipId=&leadId=&customerId=

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sp           = req.nextUrl.searchParams;
  const dealershipId = sp.get('dealershipId');
  const leadId       = sp.get('leadId');
  const customerId   = sp.get('customerId');

  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (getSupabaseAdmin() as any)
    .from('communications')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (leadId)    q = q.eq('lead_id', Number(leadId));
  if (customerId) q = q.eq('customer_id', Number(customerId));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ communications: data ?? [] });
}
