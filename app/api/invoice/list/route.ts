import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) {
    return NextResponse.json({ invoices: [] });
  }

  try {
  const { data, error } = await sb()
    .from('invoices')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/invoice/list]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invoices = data ?? [];

  // For service invoices (SRV-*), enrich with work_order_parts via work_orders.invoice_id
  const srvIds = (invoices as { id: string }[])
    .filter(i => i.id.startsWith('SRV-'))
    .map(i => i.id);

  let partsMap: Record<string, { name: string; quantity: number; unit_cost: number; total_cost: number; part_number: string }[]> = {};

  if (srvIds.length > 0) {
    const { data: wos } = await sb()
      .from('work_orders')
      .select('id, invoice_id')
      .in('invoice_id', srvIds)
      .eq('dealership_id', dealershipId);

    if (wos && wos.length > 0) {
      const woIds = (wos as { id: number; invoice_id: string }[]).map(w => w.id);
      const woInvMap: Record<number, string> = {};
      (wos as { id: number; invoice_id: string }[]).forEach(w => { woInvMap[w.id] = w.invoice_id; });

      const { data: parts } = await sb()
        .from('work_order_parts')
        .select('work_order_id, name, quantity, unit_cost, total_cost, part_number')
        .in('work_order_id', woIds);

      if (parts) {
        for (const p of parts as { work_order_id: number; name: string; quantity: number; unit_cost: number; total_cost: number; part_number: string }[]) {
          const invId = woInvMap[p.work_order_id];
          if (!invId) continue;
          if (!partsMap[invId]) partsMap[invId] = [];
          partsMap[invId].push({
            name: p.name,
            quantity: p.quantity,
            unit_cost: p.unit_cost,
            total_cost: p.total_cost,
            part_number: p.part_number ?? '',
          });
        }
      }
    }
  }

  const enriched = invoices.map((inv: Record<string, unknown>) => ({
    ...inv,
    parts: partsMap[(inv.id as string)] ?? [],
  }));

  return NextResponse.json({ invoices: enriched });
  } catch (err) {
    console.error('[api/invoice/list] unexpected error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
