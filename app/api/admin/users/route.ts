/**
 * /api/admin/users
 *
 * GET  — list all platform_admin users
 * POST — create a new platform_admin user
 * DELETE — deactivate a platform_admin user by id (?id=xxx)
 *
 * Protected: caller must have role=platform_admin in their session cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/password';

const COOKIE_NAME = 'ava_session';

function getSession(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const payload = JSON.parse(Buffer.from(cookie.value, 'base64url').toString('utf-8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// ── GET /api/admin/users ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('staff_users')
    .select('id, name, email, status, last_login, created_at')
    .eq('role', 'platform_admin')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ── POST /api/admin/users ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { name, email, password } = await req.json() as { name: string; email: string; password: string };
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'name, email and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const normalised  = email.toLowerCase().trim();
    const passwordHash = hashPassword(password);
    const sb = getSupabaseAdmin();

    const { data, error } = await (sb as any)
      .from('staff_users')
      .insert({
        name,
        email:         normalised,
        role:          'platform_admin',
        status:        'active',
        dealership_id: null,
        password_hash: passwordHash,
        bankid_verified: false,
      })
      .select('id, name, email, status, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('[admin/users POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── DELETE /api/admin/users?id=xxx ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Prevent deleting yourself
  if (session.email) {
    const sb = getSupabaseAdmin();
    const { data: self } = await (sb as any)
      .from('staff_users')
      .select('id')
      .eq('email', session.email)
      .maybeSingle();
    if (self?.id === id) {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
    }
  }

  const sb = getSupabaseAdmin();
  const { error } = await (sb as any)
    .from('staff_users')
    .update({ status: 'inactive' })
    .eq('id', id)
    .eq('role', 'platform_admin');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
