// ─── Close Lead (with optional lost reason) ───────────────────────────────────
// POST /api/leads/[id]/close
// body: { dealershipId, outcome: 'won'|'lost', lostReason?: string, createdBy?: string }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as {
    dealershipId: string;
    outcome:      'won' | 'lost';
    lostReason?:  string;
    createdBy?:   string;
  };

  if (!body.dealershipId || !id || !body.outcome) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const sb        = getSupabaseAdmin();
  const leadId    = Number(id);
  const now       = new Date().toISOString();

  // Update lead row
  const updatePayload: Record<string, unknown> = {
    stage:     'closed',
    closed_at: now,
  };
  if (body.outcome === 'lost' && body.lostReason) {
    updatePayload.lost_reason = body.lostReason;
  }

  const { error: updateErr } = await sb
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId)
    .eq('dealership_id', body.dealershipId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Append an activity log entry
  const content = body.outcome === 'won'
    ? 'Affären avslutades som vunnen 🏆'
    : `Affären avslutades som förlorad — ${body.lostReason ?? 'ingen anledning angiven'}`;

  await sb.from('lead_activities').insert({
    lead_id:       leadId,
    dealership_id: body.dealershipId,
    type:          body.outcome === 'won' ? 'stage_change' : 'lost',
    content,
    meta:          { outcome: body.outcome, lostReason: body.lostReason ?? null },
    created_by:    body.createdBy ?? null,
  });

  // Notification
  const { data: lead } = await sb.from('leads').select('name, bike').eq('id', leadId).maybeSingle();
  if (body.outcome === 'won') {
    notify({ dealershipId: body.dealershipId, type: 'payment', title: 'Affär avslutad', message: `${lead?.name ?? 'Kund'} — ${lead?.bike ?? ''} har köpts`, href: `/sales/leads/${leadId}` });
  } else {
    notify({ dealershipId: body.dealershipId, type: 'lead', title: 'Affär förlorad', message: `${lead?.name ?? 'Kund'}: ${body.lostReason ?? 'Ingen anledning angiven'}`, href: `/sales/leads/${leadId}` });
  }

  return NextResponse.json({ ok: true });
}
