import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// POST /api/service/orders/[id]/tasks — add or update a task
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId, title, description, estimatedHrs, techName } = body;
    if (!dealershipId || !title) return NextResponse.json({ error: 'dealershipId and title required' }, { status: 400 });

    const { data, error } = await sb()
      .from('work_order_tasks')
      .insert({
        dealership_id:  dealershipId,
        work_order_id:  Number(id),
        title,
        description:    description ?? '',
        estimated_hrs:  estimatedHrs ?? 0,
        tech_name:      techName ?? '',
        status:         'pending',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Recompute labor cost on the work order
    await recomputeLaborCost(id, dealershipId);

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/service/orders/[id]/tasks — update task status or actual hours
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId, taskId, status, actualHrs } = body;
    if (!dealershipId || !taskId) return NextResponse.json({ error: 'dealershipId and taskId required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    if (status    !== undefined) update.status     = status;
    if (actualHrs !== undefined) update.actual_hrs = actualHrs;

    const { data, error } = await sb()
      .from('work_order_tasks')
      .update(update)
      .eq('id', taskId)
      .eq('work_order_id', Number(id))
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recomputeLaborCost(id, dealershipId);
    return NextResponse.json({ task: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function recomputeLaborCost(orderId: string, dealershipId: string) {
  const { data: tasks } = await sb()
    .from('work_order_tasks')
    .select('actual_hrs, estimated_hrs')
    .eq('work_order_id', Number(orderId));

  const { data: wo } = await sb()
    .from('work_orders')
    .select('labor_rate, parts_cost')
    .eq('id', Number(orderId))
    .single();

  if (!wo || !tasks) return;

  const totalHrs = tasks.reduce((s: number, t: { actual_hrs: number; estimated_hrs: number }) =>
    s + (t.actual_hrs || t.estimated_hrs || 0), 0);
  const laborCost = Math.round(totalHrs * (wo.labor_rate ?? 850));
  const totalCost = laborCost + (wo.parts_cost ?? 0);

  await sb()
    .from('work_orders')
    .update({ labor_cost: laborCost, total_cost: totalCost, updated_at: new Date().toISOString() })
    .eq('id', Number(orderId))
    .eq('dealership_id', dealershipId);
}
