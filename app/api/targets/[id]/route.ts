// DELETE /api/targets/[id]  — delete a staff target

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const did = req.headers.get('x-dealership-id');
  if (!did) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

  const { id } = await params;
  const { error } = await getSupabaseAdmin()
    .from('staff_targets')
    .delete()
    .eq('id', id)
    .eq('dealership_id', did);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
