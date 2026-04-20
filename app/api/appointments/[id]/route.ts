// PUT    /api/appointments/[id]  — update status, notes, times
// DELETE /api/appointments/[id]  — remove appointment

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as {
    dealershipId:  string;
    status?:       string;
    title?:        string;
    notes?:        string;
    startTime?:    string;
    endTime?:      string;
    staffName?:    string;
    customerName?: string;
    bikeName?:     string;
  };

  if (!body.dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.status       !== undefined) patch.status        = body.status;
  if (body.title        !== undefined) patch.title         = body.title;
  if (body.notes        !== undefined) patch.notes         = body.notes;
  if (body.startTime    !== undefined) patch.start_time    = body.startTime;
  if (body.endTime      !== undefined) patch.end_time      = body.endTime;
  if (body.staffName    !== undefined) patch.staff_name    = body.staffName;
  if (body.customerName !== undefined) patch.customer_name = body.customerName;
  if (body.bikeName     !== undefined) patch.bike_name     = body.bikeName;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('appointments')
    .update(patch)
    .eq('id', Number(id))
    .eq('dealership_id', body.dealershipId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appointment: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getSupabaseAdmin() as any)
    .from('appointments')
    .delete()
    .eq('id', Number(id))
    .eq('dealership_id', dealershipId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
