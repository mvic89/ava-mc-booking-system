// GET  /api/commissions?dealershipId=&salesperson=&status=&year=&month=
// POST /api/commissions

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  try {
    const sp           = req.nextUrl.searchParams;
    const dealershipId = sp.get('dealershipId');
    const salesperson  = sp.get('salesperson');
    const status       = sp.get('status');
    const year         = sp.get('year');
    const month        = sp.get('month');

    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb()
      .from('commissions')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('closed_at', { ascending: false });

    if (salesperson) q = q.eq('salesperson', salesperson);
    if (status)      q = q.eq('status', status);
    if (year && month) {
      const from = `${year}-${String(month).padStart(2,'0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const to   = `${year}-${String(month).padStart(2,'0')}-${lastDay}T23:59:59Z`;
      q = q.gte('closed_at', from).lte('closed_at', to);
    } else if (year) {
      q = q.gte('closed_at', `${year}-01-01`).lte('closed_at', `${year}-12-31T23:59:59Z`);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ commissions: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { dealershipId, ...fields } = body;
    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    const row = {
      dealership_id:     dealershipId,
      lead_id:           fields.leadId         ?? null,
      salesperson:       fields.salesperson     ?? '',
      customer_name:     fields.customerName    ?? '',
      vehicle_name:      fields.vehicleName     ?? '',
      deal_amount:       fields.dealAmount      ?? 0,
      commission_rate:   fields.commissionRate  ?? 0,
      commission_amount: fields.commissionAmount ?? 0,
      status:            fields.status          ?? 'pending',
      closed_at:         fields.closedAt        ?? new Date().toISOString(),
      notes:             fields.notes           ?? '',
    };

    const { data, error } = await sb()
      .from('commissions')
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ commission: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
