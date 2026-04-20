// GET  /api/appointments?dealershipId=&from=&to=&leadId=
// POST /api/appointments

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const sp           = req.nextUrl.searchParams;
  const dealershipId = sp.get('dealershipId');
  const from         = sp.get('from');   // ISO date e.g. 2026-04-14
  const to           = sp.get('to');     // ISO date e.g. 2026-04-20
  const leadId       = sp.get('leadId');

  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (getSupabaseAdmin() as any)
    .from('appointments')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('start_time', { ascending: true });

  if (from)   q = q.gte('start_time', from);
  if (to)     q = q.lte('start_time', to + 'T23:59:59Z');
  if (leadId) q = q.eq('lead_id', Number(leadId));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appointments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    dealershipId:  string;
    leadId?:       number | null;
    customerId?:   number | null;
    type?:         string;
    title?:        string;
    notes?:        string;
    startTime:     string;   // ISO
    endTime:       string;   // ISO
    staffName?:    string;
    customerName?: string;
    bikeName?:     string;
    createdBy?:    string;
  };

  if (!body.dealershipId || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Conflict check — same staff, overlapping time
  if (body.staffName) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conflicts } = await (getSupabaseAdmin() as any)
      .from('appointments')
      .select('id, title, start_time, end_time')
      .eq('dealership_id', body.dealershipId)
      .eq('staff_name', body.staffName)
      .neq('status', 'cancelled')
      .lt('start_time', body.endTime)
      .gt('end_time', body.startTime);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: 'Conflict: staff already has an appointment at this time', conflicts },
        { status: 409 },
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data, error } = await sb
    .from('appointments')
    .insert({
      dealership_id: body.dealershipId,
      lead_id:       body.leadId      ?? null,
      customer_id:   body.customerId  ?? null,
      type:          body.type        ?? 'test_drive',
      title:         body.title       ?? null,
      notes:         body.notes       ?? null,
      start_time:    body.startTime,
      end_time:      body.endTime,
      staff_name:    body.staffName   ?? null,
      customer_name: body.customerName ?? null,
      bike_name:     body.bikeName    ?? null,
      status:        'scheduled',
      created_by:    body.createdBy   ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const typeLabels: Record<string, string> = { test_drive: 'Provkörning', meeting: 'Möte', delivery: 'Leverans', viewing: 'Visning' };
  const typeLabel = typeLabels[body.type ?? 'test_drive'] ?? 'Bokning';
  const startStr  = new Date(body.startTime).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  notify({
    dealershipId: body.dealershipId,
    type:    'system',
    title:   `Ny bokning: ${typeLabel}`,
    message: `${body.customerName ?? 'Kund'} — ${body.bikeName ?? ''} ${startStr}`,
    href:    '/calendar',
  });

  return NextResponse.json({ appointment: data }, { status: 201 });
}
