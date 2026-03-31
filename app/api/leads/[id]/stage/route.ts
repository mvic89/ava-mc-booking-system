// ─── POST /api/leads/[id]/stage ───────────────────────────────────────────────
// Advances a lead's pipeline stage using the service-role client so Supabase
// RLS on the leads table never blocks the UPDATE.
//
// Body: { dealershipId: string, stage: string, fromStages?: string[] }
//   fromStages — optional list of stages the lead must currently be in.
//               Use this to prevent accidentally regressing a lead that has
//               already moved further along (e.g. already 'closed').

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leadId } = await params;
    const body = await req.json() as {
      dealershipId: string;
      stage:        string;
      fromStages?:  string[];
    };
    const { dealershipId, stage, fromStages } = body;

    if (!dealershipId || !stage || !leadId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = sb()
      .from('leads')
      .update({ stage, stage_changed_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('dealership_id', dealershipId);

    if (fromStages && fromStages.length > 0) {
      query = query.in('stage', fromStages);
    }

    const { error } = await query;

    if (error) {
      console.error('[api/leads/stage]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logAudit({
      action:       'LEAD_STAGE_CHANGED',
      entity:       'lead',
      entityId:     leadId,
      details:      { stage },
      dealershipId: dealershipId,
      ipAddress:    req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/leads/stage] unexpected:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
