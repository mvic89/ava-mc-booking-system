// POST /api/invite/create
// Saves a pending staff invite to the staff_invites table.
// Uses the service-role key so it works regardless of RLS.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      email:          string;
      name:           string;
      role:           string;
      dealershipId:   string;
      dealershipName: string;
      invitedBy?:     string;
    };

    const { email, name, role, dealershipId, dealershipName, invitedBy } = body;
    if (!email || !name || !role || !dealershipId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await sb()
      .from('staff_invites')
      .insert({
        email:           normalizedEmail,
        name,
        role,
        dealership_id:   dealershipId,
        dealership_name: dealershipName,
        invited_by:      invitedBy ?? null,
        expires_at:      expiresAt,
        accepted:        false,
      })
      .select('token')
      .single();

    if (error) {
      console.error('[invite/create]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const token = (data as { token: string }).token;

    // Pre-create the staff_users row as 'pending' so the user appears in the
    // team list immediately (before they accept). Upsert on email so re-inviting
    // an existing address doesn't duplicate the row.
    const { error: staffErr } = await sb()
      .from('staff_users')
      .upsert(
        {
          dealership_id:   dealershipId,
          email:           normalizedEmail,
          name,
          role,
          status:          'pending',
          bankid_verified: false,
          personal_number: null,
        },
        { onConflict: 'email' },
      );

    if (staffErr) {
      console.error('[invite/create] staff_users upsert failed:', staffErr.message);
      // Non-fatal — the invite token is still valid; user can still accept
    }

    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
