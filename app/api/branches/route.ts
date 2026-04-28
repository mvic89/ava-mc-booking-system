// GET  /api/branches       — list all branches for a dealership
// POST /api/branches       — create a new branch

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

function dealershipId(req: NextRequest) {
  return req.headers.get('x-dealership-id');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any) {
  return {
    id:          r.id,
    dealershipId: r.dealership_id,
    name:        r.name,
    address:     r.address,
    city:        r.city,
    phone:       r.phone,
    managerName: r.manager_name,
    active:      r.active,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const did = dealershipId(req);
  if (!did) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('branches')
    .select('*')
    .eq('dealership_id', did)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(mapRow));
}

export async function POST(req: NextRequest) {
  const did = dealershipId(req);
  if (!did) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

  const body = await req.json();
  const { name, address, city, phone, managerName, active = true } = body;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from('branches')
    .insert({ dealership_id: did, name, address, city, phone, manager_name: managerName, active })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(mapRow(data), { status: 201 });
}
