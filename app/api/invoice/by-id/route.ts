// GET  /api/invoice/by-id?id=SRV-2026-001&dealershipId=...
// PATCH /api/invoice/by-id  { id, dealershipId, totalAmount }
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  const id           = req.nextUrl.searchParams.get('id');
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');

  if (!id || !dealershipId) {
    return NextResponse.json({ error: 'id and dealershipId required' }, { status: 400 });
  }

  const { data, error } = await sb()
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('dealership_id', dealershipId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({ invoice: data });
}

export async function PATCH(req: NextRequest) {
  const { id, dealershipId, totalAmount } = await req.json() as {
    id: string; dealershipId: string; totalAmount: number;
  };

  if (!id || !dealershipId || totalAmount == null) {
    return NextResponse.json({ error: 'id, dealershipId, totalAmount required' }, { status: 400 });
  }

  const total  = Math.round(totalAmount * 100) / 100;
  const vat    = Math.round(total * 0.2 * 100) / 100;
  const net    = Math.round((total - vat) * 100) / 100;

  const { error } = await sb()
    .from('invoices')
    .update({ total_amount: total, vat_amount: vat, net_amount: net })
    .eq('id', id)
    .eq('dealership_id', dealershipId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, totalAmount: total, vatAmount: vat, netAmount: net });
}
