import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json() as { token: string; password: string };

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const sb = getSupabaseServer();

    // Validate the token
    const { data: tokenRow } = await (sb as any)
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle() as { data: { id: string; email: string; expires_at: string } | null };

    if (!tokenRow) {
      return NextResponse.json(
        { error: 'Invalid or already-used reset link. Please request a new one.' },
        { status: 400 },
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 400 },
      );
    }

    // Hash and store the new password; also ensure the account is active
    const passwordHash = hashPassword(password);
    const { error: updateError } = await (sb as any)
      .from('staff_users')
      .update({ password_hash: passwordHash, status: 'active' })
      .eq('email', tokenRow.email);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Mark the token as consumed so it cannot be reused
    await (sb as any)
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', tokenRow.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[auth/reset-password]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
