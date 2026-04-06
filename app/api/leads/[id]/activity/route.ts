// ─── Lead Activity Log ────────────────────────────────────────────────────────
// GET  /api/leads/[id]/activity?dealershipId=…   — fetch all activities for a lead
// POST /api/leads/[id]/activity                   — append a new activity entry

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'stage_change' | 'score_update' | 'reminder' | 'lost';

export interface LeadActivity {
  id:          number;
  leadId:      number;
  type:        ActivityType;
  content:     string;
  meta:        Record<string, unknown> | null;
  createdBy:   string;
  createdAt:   string;
}

function mapRow(row: Record<string, unknown>): LeadActivity {
  return {
    id:        row.id        as number,
    leadId:    row.lead_id   as number,
    type:      row.type      as ActivityType,
    content:   (row.content  as string) ?? '',
    meta:      (row.meta     as Record<string, unknown>) ?? null,
    createdBy: (row.created_by as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId || !id) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('lead_activities')
    .select('*')
    .eq('lead_id', Number(id))
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activities: (data ?? []).map(r => mapRow(r as Record<string, unknown>)) });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as {
    dealershipId: string;
    type:         ActivityType;
    content?:     string;
    meta?:        Record<string, unknown>;
    createdBy?:   string;
  };

  if (!body.dealershipId || !id || !body.type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('lead_activities')
    .insert({
      lead_id:       Number(id),
      dealership_id: body.dealershipId,
      type:          body.type,
      content:       body.content ?? null,
      meta:          body.meta    ?? null,
      created_by:    body.createdBy ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: mapRow(data as Record<string, unknown>) });
}
