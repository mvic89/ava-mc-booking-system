import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// POST /api/service/time — clock in
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealershipId, workOrderId, taskId, techName, billable, notes } = body;
    if (!dealershipId || !workOrderId) {
      return NextResponse.json({ error: 'dealershipId and workOrderId required' }, { status: 400 });
    }

    // Check if tech is already clocked in on this order
    const { data: existing } = await sb()
      .from('tech_time_entries')
      .select('id')
      .eq('work_order_id', workOrderId)
      .eq('tech_name', techName ?? '')
      .is('clocked_out_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Tekniker är redan incheckad på denna order' }, { status: 409 });
    }

    const { data, error } = await sb()
      .from('tech_time_entries')
      .insert({
        dealership_id:  dealershipId,
        work_order_id:  workOrderId,
        task_id:        taskId ?? null,
        tech_name:      techName ?? '',
        clocked_in_at:  new Date().toISOString(),
        billable:       billable ?? true,
        notes:          notes ?? '',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-set work order to in_progress if it was created
    await sb()
      .from('work_orders')
      .update({ status: 'in_progress', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', workOrderId)
      .eq('dealership_id', dealershipId)
      .eq('status', 'created');

    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/service/time — clock out
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealershipId, entryId, notes } = body;
    if (!dealershipId || !entryId) {
      return NextResponse.json({ error: 'dealershipId and entryId required' }, { status: 400 });
    }

    const clockOutAt = new Date().toISOString();

    // Fetch the entry to compute duration
    const { data: entry } = await sb()
      .from('tech_time_entries')
      .select('clocked_in_at')
      .eq('id', entryId)
      .single();

    const durationMin = entry
      ? Math.round((new Date(clockOutAt).getTime() - new Date(entry.clocked_in_at).getTime()) / 60000)
      : null;

    const { data, error } = await sb()
      .from('tech_time_entries')
      .update({
        clocked_out_at: clockOutAt,
        duration_min:   durationMin,
        notes:          notes ?? undefined,
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
