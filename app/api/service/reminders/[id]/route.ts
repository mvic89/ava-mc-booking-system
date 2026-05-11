import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// PATCH /api/service/reminders/[id] — update interval, status, last service, notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId } = body;
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { updated_at: now };

    const allowed = [
      'customer_name', 'customer_email', 'customer_phone',
      'vehicle_name', 'plate', 'vin', 'interval_months',
      'last_service_at', 'next_reminder_at', 'status', 'notes',
    ] as const;
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    // If last_service_at changed and no explicit next_reminder_at, recompute
    if (body.last_service_at && !body.next_reminder_at) {
      const { data: existing } = await sb()
        .from('service_reminders')
        .select('interval_months')
        .eq('id', Number(id))
        .single();
      const months = body.interval_months ?? existing?.interval_months ?? 12;
      update.next_reminder_at = addMonths(body.last_service_at, months);
    }

    const { data, error } = await sb()
      .from('service_reminders')
      .update(update)
      .eq('id', Number(id))
      .eq('dealership_id', dealershipId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reminder: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/service/reminders/[id]?dealershipId=…
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    const { error } = await sb()
      .from('service_reminders')
      .delete()
      .eq('id', Number(id))
      .eq('dealership_id', dealershipId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
