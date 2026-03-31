// ─── DELETE /api/customers/delete ─────────────────────────────────────────────
// Server-side customer deletion using the service-role client so Supabase RLS
// never blocks the DELETE.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function POST(req: Request) {
  try {
    const { dealershipId, ids } = await req.json() as {
      dealershipId: string;
      ids:          number[];
    };

    if (!dealershipId || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing dealershipId or ids' }, { status: 400 });
    }

    const { error } = await sb()
      .from('customers')
      .delete()
      .in('id', ids)
      .eq('dealership_id', dealershipId);

    if (error) {
      console.error('[api/customers/delete]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error('[api/customers/delete] unexpected:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
