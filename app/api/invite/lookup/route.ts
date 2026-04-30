// GET /api/invite/lookup?token=...
// Returns the invite if the token is valid, unexpired, and not yet accepted.
// No authentication required — the token itself is the credential.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ invite: null });

  const { data, error } = await sb()
    .from('staff_invites')
    .select('token, email, name, role, dealership_id, dealership_name, expires_at, accepted')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[invite/lookup]', error.message);
    return NextResponse.json({ invite: null });
  }

  if (!data) return NextResponse.json({ invite: null, reason: 'not_found' });

  const row = data as {
    token:           string;
    email:           string;
    name:            string;
    role:            string;
    dealership_id:   string;
    dealership_name: string;
    expires_at:      string;
    accepted:        boolean;
  };

  if (row.accepted) return NextResponse.json({ invite: null, reason: 'accepted' });
  if (new Date(row.expires_at) < new Date()) return NextResponse.json({ invite: null, reason: 'expired' });

  return NextResponse.json({
    invite: {
      token:          row.token,
      email:          row.email,
      name:           row.name,
      role:           row.role,
      dealershipId:   row.dealership_id,
      dealershipName: row.dealership_name,
    },
  });
}
