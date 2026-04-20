// GET  /api/trade-ins?leadId=X&dealershipId=Y
// POST /api/trade-ins

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  try {
    const leadId       = req.nextUrl.searchParams.get('leadId');
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb()
      .from('trade_ins')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false });

    // leadId is optional — if provided, filter by lead; if omitted, return all for dealership
    if (leadId && leadId !== '0') q = q.eq('lead_id', leadId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tradeIns: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { dealershipId, leadId, offerId, ...fields } = body;
    if (!dealershipId || !leadId)
      return NextResponse.json({ error: 'Missing dealershipId or leadId' }, { status: 400 });

    const row = {
      lead_id:             leadId,
      dealership_id:       dealershipId,
      offer_id:            offerId ?? null,
      description:         fields.description         ?? '',
      registration_number: fields.registrationNumber  ?? '',
      vin:                 fields.vin                 ?? '',
      brand:               fields.brand               ?? '',
      model:               fields.model               ?? '',
      year:                fields.year                ?? null,
      color:               fields.color               ?? '',
      mileage:             fields.mileage             ?? null,
      credit_value:        fields.creditValue         ?? 0,
      status:              fields.status              ?? 'pending',
      notes:               fields.notes               ?? '',
    };

    const { data, error } = await sb()
      .from('trade_ins')
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tradeIn: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
