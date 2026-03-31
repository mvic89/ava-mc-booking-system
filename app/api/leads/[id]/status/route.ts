// ─── POST /api/leads/[id]/status ─────────────────────────────────────────────
// Updates a lead's hot / warm / cold status using the service-role client so
// Supabase RLS on the leads table never blocks the UPDATE.
//
// Body: { dealershipId: string, status: 'hot' | 'warm' | 'cold' }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

const VALID_STATUSES = ['hot', 'warm', 'cold'] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leadId } = await params;
    const body = await req.json() as { dealershipId: string; status: string };
    const { dealershipId, status } = body;

    if (!dealershipId || !status || !leadId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const { error } = await sb()
      .from('leads')
      .update({ lead_status: status })
      .eq('id', leadId)
      .eq('dealership_id', dealershipId);

    if (error) {
      console.error('[api/leads/status]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logAudit({
      action:       'LEAD_STATUS_CHANGED',
      entity:       'lead',
      entityId:     leadId,
      details:      { lead_status: status },
      dealershipId: dealershipId,
      ipAddress:    req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/leads/status] unexpected:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
