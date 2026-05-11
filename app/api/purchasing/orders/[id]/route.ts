import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/purchasing/orders/[id]?dealershipId=…
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

  const { data, error } = await sb()
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('id', id)
    .eq('dealership_id', dealershipId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

// PATCH /api/purchasing/orders/[id] — update status, eta, notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId } = body;
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of ['status', 'eta', 'notes', 'vendor', 'total_cost'] as const) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const { data, error } = await sb()
      .from('purchase_orders')
      .update(update)
      .eq('id', id)
      .eq('dealership_id', dealershipId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ order: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
