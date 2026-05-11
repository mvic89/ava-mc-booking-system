// POST /api/invite/accept
// Called from the accept-invite page after the user verifies their identity.
// Uses the service-role key so it can write to staff_users regardless of RLS.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => getSupabaseAdmin() as any;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealershipId:   string;
      email:          string;
      name:           string;
      role:           string;
      bankidVerified: boolean;
      personalNumber: string | null;
      token?:         string;
    };

    const { dealershipId, email, name, role, bankidVerified, personalNumber, token } = body;

    if (!dealershipId || !email || !name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert using service-role key — bypasses RLS
    const { error } = await sb()
      .from('staff_users')
      .upsert(
        {
          dealership_id:   dealershipId,
          email:           email.toLowerCase().trim(),
          name,
          role,
          status:          'active',
          bankid_verified: bankidVerified,
          personal_number: personalNumber ?? null,
          last_login:      new Date().toISOString(),
        },
        { onConflict: 'email' },
      );

    if (error) {
      console.error('[invite/accept]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark invite as accepted so the link cannot be reused
    if (token) {
      await sb()
        .from('staff_invites')
        .update({ accepted: true, accepted_at: new Date().toISOString() })
        .eq('token', token);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
