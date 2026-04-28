// GET  /api/warranties?dealershipId=&status=&expiringDays=30
// POST /api/warranties

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  try {
    const sp           = req.nextUrl.searchParams;
    const dealershipId = sp.get('dealershipId');
    const status       = sp.get('status');
    const expiringDays = sp.get('expiringDays');

    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb()
      .from('warranties')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('end_date', { ascending: true });

    if (status) q = q.eq('status', status);
    if (expiringDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + parseInt(expiringDays));
      q = q.lte('end_date', cutoff.toISOString().split('T')[0]);
      q = q.gte('end_date', new Date().toISOString().split('T')[0]);
      q = q.eq('status', 'active');
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ warranties: data ?? [] });
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
      dealership_id:   dealershipId,
      lead_id:         fields.leadId       ?? null,
      customer_id:     fields.customerId   ?? null,
      vehicle_name:    fields.vehicleName  ?? '',
      vin:             fields.vin          ?? '',
      registration_nr: fields.registrationNr ?? '',
      type:            fields.type         ?? 'standard',
      provider:        fields.provider     ?? '',
      policy_number:   fields.policyNumber ?? '',
      start_date:      fields.startDate,
      end_date:        fields.endDate,
      coverage_amount: fields.coverageAmount ?? 0,
      status:          fields.status       ?? 'active',
      notes:           fields.notes        ?? '',
      created_by:      fields.createdBy    ?? '',
    };

    if (!row.start_date || !row.end_date)
      return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });

    const { data, error } = await sb()
      .from('warranties')
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    notify({
      dealershipId: dealershipId as string,
      type:    'system',
      title:   'Ny garanti registrerad',
      message: `${row.vehicle_name} — ${row.type} — giltig t.o.m. ${row.end_date}`,
      href:    '/warranties',
    });

    return NextResponse.json({ warranty: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
