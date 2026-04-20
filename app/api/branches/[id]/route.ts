// PATCH  /api/branches/[id]  — update a branch
// DELETE /api/branches/[id]  — delete a branch

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const did = req.headers.get('x-dealership-id');
  if (!did) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.name        !== undefined) update.name         = body.name;
  if (body.address     !== undefined) update.address      = body.address;
  if (body.city        !== undefined) update.city         = body.city;
  if (body.phone       !== undefined) update.phone        = body.phone;
  if (body.managerName !== undefined) update.manager_name = body.managerName;
  if (body.active      !== undefined) update.active       = body.active;
  update.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('branches')
    .update(update)
    .eq('id', id)
    .eq('dealership_id', did)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' },    { status: 404 });
  return NextResponse.json(mapRow(data));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const did = req.headers.get('x-dealership-id');
  if (!did) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

  const { id } = await params;
  const { error } = await getSupabaseAdmin()
    .from('branches')
    .delete()
    .eq('id', id)
    .eq('dealership_id', did);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
