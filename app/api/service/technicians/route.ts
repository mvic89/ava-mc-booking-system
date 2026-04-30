import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/service/technicians?dealershipId=…
// Returns all active staff with role = 'service' for the dealership.
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ technicians: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;

  const { data, error } = await sb
    .from('staff_users')
    .select('id, name, email, role')
    .eq('dealership_id', dealershipId)
    .eq('status', 'active')
    .in('role', ['service', 'technician'])
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ technicians: data ?? [] });
}
