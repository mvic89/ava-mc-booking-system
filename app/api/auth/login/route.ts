/**
 * POST /api/auth/login
 * Server-side email + password authentication using the service-role key.
 * This bypasses all RLS / anon-key restrictions so both dealer staff
 * and the platform admin (dealership_id = NULL) are found reliably.
 *
 * Returns:
 *   200 { role, dealershipId, name, email }
 *   401 { error: 'wrong_password' }
 *   403 { error: 'bankid_only' }
 *   404 { error: 'not_found' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email: string; password: string };
    if (!email || !password) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const normalised = email.toLowerCase().trim();
    const sb = getSupabaseAdmin();

    const { data: row, error } = await (sb as any)
      .from('staff_users')
      .select('id, role, dealership_id, name, email, password_hash, bankid_verified, status, roaring_data, date_of_birth')
      .eq('email', normalised)
      .maybeSingle() as {
        data: {
          id: string;
          role: string;
          dealership_id: string | null;
          name: string;
          email: string;
          password_hash: string | null;
          bankid_verified: boolean;
          status: string;
          roaring_data: object | null;
          date_of_birth: string | null;
        } | null;
        error: unknown;
      };

    if (error || !row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // BankID-only account — no password set
    if (!row.password_hash && row.bankid_verified) {
      return NextResponse.json({ error: 'bankid_only' }, { status: 403 });
    }

    // Verify password when a hash exists
    if (row.password_hash) {
      if (!verifyPassword(password, row.password_hash)) {
        return NextResponse.json({ error: 'wrong_password' }, { status: 401 });
      }
    }

    // Update last_login
    await (sb as any)
      .from('staff_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', row.id);

    return NextResponse.json({
      role:         row.role,
      dealershipId: row.dealership_id ?? '',
      name:         row.name,
      email:        row.email,
      roaringData:  row.roaring_data  ?? null,
      dateOfBirth:  row.date_of_birth ?? '',
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
