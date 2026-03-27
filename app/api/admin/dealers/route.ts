/**
 * GET /api/admin/dealers
 * Returns all dealerships with staff count and last login.
 * Uses service-role key so RLS does not block the read.
 * Protected: caller must have role=platform_admin in their session cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = getSupabaseAdmin() as any;

  // Fetch all dealership settings rows
  const { data: settings, error } = await sb
    .from('dealership_settings')
    .select('dealership_id, name, org_nr, email, phone, city, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!settings?.length) return NextResponse.json([]);

  // For each dealership fetch staff count + latest login in parallel
  const dealers = await Promise.all(
    settings.map(async (s: any) => {
      const [{ count }, { data: latest }] = await Promise.all([
        sb.from('staff_users')
          .select('id', { count: 'exact', head: true })
          .eq('dealership_id', s.dealership_id),
        sb.from('staff_users')
          .select('last_login')
          .eq('dealership_id', s.dealership_id)
          .order('last_login', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        id:          s.dealership_id,
        name:        s.name        ?? 'Unnamed Dealership',
        org_nr:      s.org_nr      ?? null,
        email:       s.email       ?? null,
        phone:       s.phone       ?? null,
        city:        s.city        ?? null,
        registered:  s.updated_at  ?? null,
        staff_count: count         ?? 0,
        last_login:  latest?.last_login ?? null,
      };
    }),
  );

  return NextResponse.json(dealers);
}
