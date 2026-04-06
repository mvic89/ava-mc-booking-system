// ─── PATCH /api/customers/update ───────────────────────────────────────────────
// Server-side customer update using the service-role client so Supabase RLS
// never blocks the write. Handles editable fields: email, phone, tag, notes,
// and nps_score (stored as a numeric column on the customers table).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function POST(req: Request) {
  try {
    const { dealershipId, id, fields } = await req.json() as {
      dealershipId: string;
      id:           number;
      fields: {
        email?:     string;
        phone?:     string;
        tag?:       string;
        notes?:     string;
        nps_score?: number | null;
      };
    };

    if (!dealershipId || !id || !fields) {
      return NextResponse.json({ error: 'Missing dealershipId, id or fields' }, { status: 400 });
    }

    // Build update payload — only include keys that were passed
    const payload: Record<string, unknown> = {};
    if (fields.email     !== undefined) payload.email     = fields.email     || null;
    if (fields.phone     !== undefined) payload.phone     = fields.phone     || null;
    if (fields.tag       !== undefined) payload.tag       = fields.tag;
    if (fields.notes     !== undefined) payload.notes     = fields.notes     || null;
    if ('nps_score' in fields)          payload.nps_score = fields.nps_score ?? null;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: true, message: 'Nothing to update' });
    }

    const { error } = await sb()
      .from('customers')
      .update(payload)
      .eq('id', id)
      .eq('dealership_id', dealershipId);

    if (error) {
      console.error('[api/customers/update]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/update] unexpected:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
