// PUT  /api/tasks/[id]   — update status, title, due date, etc.
// DELETE /api/tasks/[id] — remove task

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as {
    dealershipId:  string;
    title?:        string;
    description?:  string;
    type?:         string;
    priority?:     string;
    status?:       string;
    dueDate?:      string | null;
    snoozeUntil?:  string | null;
    assignedTo?:   string;
  };

  if (!body.dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.title       !== undefined) patch.title        = body.title;
  if (body.description !== undefined) patch.description  = body.description;
  if (body.type        !== undefined) patch.type         = body.type;
  if (body.priority    !== undefined) patch.priority     = body.priority;
  if (body.assignedTo  !== undefined) patch.assigned_to  = body.assignedTo;
  if (body.dueDate     !== undefined) patch.due_date     = body.dueDate;
  if (body.snoozeUntil !== undefined) patch.snoozed_until = body.snoozeUntil;

  if (body.status !== undefined) {
    patch.status = body.status;
    if (body.status === 'done') patch.completed_at = new Date().toISOString();
    if (body.status === 'open') patch.completed_at = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data, error } = await sb
    .from('tasks')
    .update(patch)
    .eq('id', Number(id))
    .eq('dealership_id', body.dealershipId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
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
    .from('tasks')
    .delete()
    .eq('id', Number(id))
    .eq('dealership_id', dealershipId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
