// ─── POST /api/dealership/ensure ──────────────────────────────────────────────
// Upserts the dealership row using the service-role client so Supabase RLS
// on the dealerships table never blocks the write.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function POST(req: Request) {
  try {
    const { dealershipId, name, email, phone } = await req.json() as {
      dealershipId: string;
      name?:        string;
      email?:       string;
      phone?:       string;
    };

    if (!dealershipId) {
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
    }

    const { error } = await sb()
      .from('dealerships')
      .upsert(
        { id: dealershipId, name: name || 'Dealership', email: email || null, phone: phone || null },
        { onConflict: 'id', ignoreDuplicates: true },
      );

    if (error) {
      console.error('[api/dealership/ensure]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/dealership/ensure] unexpected:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
