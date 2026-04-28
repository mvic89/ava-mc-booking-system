// PUT  /api/commissions/[id]  — update status (approve / pay / void)
// GET  /api/commissions/[id]  — fetch single

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await sb().from('commissions').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commission: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await req.json() as { status?: string; approvedBy?: string; paidAt?: string; notes?: string; commissionRate?: number; commissionAmount?: number };

    const update: Record<string, unknown> = {};
    if (body.status)           update.status            = body.status;
    if (body.approvedBy)       update.approved_by       = body.approvedBy;
    if (body.paidAt)           update.paid_at           = body.paidAt;
    if (body.notes !== undefined) update.notes          = body.notes;
    if (body.commissionRate !== undefined)   update.commission_rate   = body.commissionRate;
    if (body.commissionAmount !== undefined) update.commission_amount = body.commissionAmount;

    if (body.status === 'paid' && !body.paidAt) update.paid_at = new Date().toISOString();

    const { data, error } = await sb()
      .from('commissions')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ commission: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
