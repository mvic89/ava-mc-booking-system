// GET /api/leads/[id]?dealershipId=X
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }      = await params;
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from('leads')
      .select('id,name,bike,value,cost_price,lead_status,stage,email,phone,personnummer,created_at,notes,salesperson_name,source,lead_type,lead_items')
      .eq('id', id)
      .eq('dealership_id', dealershipId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)  return NextResponse.json({ error: 'Not found' },    { status: 404 });

    return NextResponse.json({ lead: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
