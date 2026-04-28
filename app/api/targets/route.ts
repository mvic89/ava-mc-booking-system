// GET  /api/targets       — list targets for a dealership (optionally filtered by year)
// POST /api/targets       — upsert (insert or update) a staff target

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any) {
  return {
    id:            r.id,
    dealershipId:  r.dealership_id,
    staffEmail:    r.staff_email,
    staffName:     r.staff_name,
    periodYear:    r.period_year,
    periodMonth:   r.period_month,
    leadsTarget:   r.leads_target,
    revenueTarget: r.revenue_target,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const did = req.headers.get('x-dealership-id');
  if (!did) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');

  let query = getSupabaseAdmin()
    .from('staff_targets')
    .select('*')
    .eq('dealership_id', did)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: true })
    .order('staff_name', { ascending: true });

  if (year) query = query.eq('period_year', Number(year));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(mapRow));
}

export async function POST(req: NextRequest) {
  const did = req.headers.get('x-dealership-id');
  if (!did) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

  const body = await req.json();
  const { staffEmail, staffName, periodYear, periodMonth, leadsTarget, revenueTarget } = body;

  if (!staffEmail || !staffName || periodYear == null || periodMonth == null) {
    return NextResponse.json({ error: 'staffEmail, staffName, periodYear, periodMonth required' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Upsert: conflict on (dealership_id, staff_email, period_year, period_month)
  const { data, error } = await getSupabaseAdmin()
    .from('staff_targets')
    .upsert(
      {
        dealership_id:  did,
        staff_email:    staffEmail,
        staff_name:     staffName,
        period_year:    periodYear,
        period_month:   periodMonth,
        leads_target:   leadsTarget   ?? 0,
        revenue_target: revenueTarget ?? 0,
        updated_at:     now,
      },
      { onConflict: 'dealership_id,staff_email,period_year,period_month' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(mapRow(data), { status: 200 });
}
