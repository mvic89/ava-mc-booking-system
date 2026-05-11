import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/vehicles/[key]?dealershipId=…
// key = VIN, plate, or id-{workOrderId}. Returns all work orders for that vehicle.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key }      = await params;
  const decoded      = decodeURIComponent(key).trim();
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ orders: [] });

  const seen   = new Set<number>();
  const merged: unknown[] = [];

  function addOrders(rows: unknown[] | null) {
    for (const o of rows ?? []) {
      const id = (o as { id: number }).id;
      if (!seen.has(id)) { seen.add(id); merged.push(o); }
    }
  }

  // Handle id-{N} fallback key (vehicle with no VIN/plate)
  const idMatch = decoded.match(/^id-(\d+)$/);
  if (idMatch) {
    const orderId = Number(idMatch[1]);
    // Fetch the anchor order to get its VIN/plate, then search by those
    const { data: anchor } = await sb()
      .from('work_orders')
      .select('*')
      .eq('id', orderId)
      .eq('dealership_id', dealershipId)
      .maybeSingle();

    if (anchor) {
      addOrders([anchor]);
      // If it has a VIN or plate, find all sibling orders
      if (anchor.vin && anchor.vin.length > 5) {
        const { data } = await sb().from('work_orders').select('*').eq('dealership_id', dealershipId).ilike('vin', anchor.vin).order('created_at', { ascending: false });
        addOrders(data);
      } else if (anchor.plate) {
        const { data } = await sb().from('work_orders').select('*').eq('dealership_id', dealershipId).ilike('plate', anchor.plate).order('created_at', { ascending: false });
        addOrders(data);
      }
    }
  } else {
    // Normal path: search by VIN and plate in parallel
    const [vinRes, plateRes] = await Promise.all([
      sb().from('work_orders').select('*').eq('dealership_id', dealershipId).ilike('vin', decoded).order('created_at', { ascending: false }),
      sb().from('work_orders').select('*').eq('dealership_id', dealershipId).ilike('plate', decoded).order('created_at', { ascending: false }),
    ]);
    if (vinRes.error)   console.error('[vehicles/[key]] vin query:', vinRes.error.message);
    if (plateRes.error) console.error('[vehicles/[key]] plate query:', plateRes.error.message);
    addOrders(vinRes.data);
    addOrders(plateRes.data);
  }

  merged.sort((a, b) =>
    new Date((b as { created_at: string }).created_at).getTime() -
    new Date((a as { created_at: string }).created_at).getTime()
  );

  return NextResponse.json({ orders: merged });
}
