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
import { notify } from '@/lib/notify';

const STAGE_LABELS: Record<string, string> = {
  new: 'Ny', contacted: 'Kontaktad', testride: 'Provkörning',
  offer: 'Offert', negotiating: 'Förhandling',
  pending_payment: 'Väntande betalning', closed: 'Avslutad',
};

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
      clearLost?:   boolean;
    };
    const { dealershipId, stage, fromStages } = body;

    if (!dealershipId || !stage || !leadId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = sb()
      .from('leads')
      .update({
        stage,
        stage_changed_at: new Date().toISOString(),
        // Clear lost/closed fields when reactivating a lost lead
        ...(body.clearLost ? { lost_reason: null, closed_at: null } : {}),
      })
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

    // Fetch lead name for notification
    const { data: lead } = await sb().from('leads').select('name, bike').eq('id', leadId).maybeSingle();
    const label = STAGE_LABELS[stage] ?? stage;

    if (body.clearLost) {
      notify({ dealershipId, type: 'lead', title: 'Lead återaktiverat', message: `${lead?.name ?? 'Lead'} är tillbaka i pipeline`, href: `/sales/leads/${leadId}` });
    } else {
      notify({ dealershipId, type: 'lead', title: `Pipeline: ${label}`, message: `${lead?.name ?? 'Lead'} → ${label}`, href: `/sales/leads/${leadId}` });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/leads/stage] unexpected:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
