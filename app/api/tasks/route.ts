// GET  /api/tasks?dealershipId=&leadId=&status=&assignedTo=
// POST /api/tasks

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sp           = req.nextUrl.searchParams;
  const dealershipId = sp.get('dealershipId');
  const leadId       = sp.get('leadId');
  const status       = sp.get('status');      // 'open' | 'done' | 'snoozed' | omit for all
  const assignedTo   = sp.get('assignedTo');

  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (getSupabaseAdmin() as any)
    .from('tasks')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (leadId)     q = q.eq('lead_id', Number(leadId));
  if (status)     q = q.eq('status', status);
  if (assignedTo) q = q.eq('assigned_to', assignedTo);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    dealershipId: string;
    leadId?:      number | null;
    customerId?:  number | null;
    title:        string;
    description?: string;
    type?:        string;
    priority?:    string;
    dueDate?:     string | null;
    assignedTo?:  string;
    createdBy?:   string;
  };

  if (!body.dealershipId || !body.title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data, error } = await sb
    .from('tasks')
    .insert({
      dealership_id: body.dealershipId,
      lead_id:       body.leadId     ?? null,
      customer_id:   body.customerId ?? null,
      title:         body.title,
      description:   body.description ?? null,
      type:          body.type        ?? 'follow_up',
      priority:      body.priority    ?? 'medium',
      status:        'open',
      due_date:      body.dueDate     ?? null,
      assigned_to:   body.assignedTo  ?? null,
      created_by:    body.createdBy   ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
