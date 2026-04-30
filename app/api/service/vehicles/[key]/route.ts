import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/vehicles/[key]?dealershipId=…
// key = VIN or plate (URL-encoded). Returns all work orders for that vehicle.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key }      = await params;
  const decoded      = decodeURIComponent(key).trim();
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ orders: [] });

  // Run VIN and plate queries in parallel — covers the case where the key
  // is a VIN on some orders and a plate on others, or case mismatches.
  const [vinRes, plateRes] = await Promise.all([
    sb()
      .from('work_orders')
      .select('*')
      .eq('dealership_id', dealershipId)
      .ilike('vin', decoded)
      .order('created_at', { ascending: false }),
    sb()
      .from('work_orders')
      .select('*')
      .eq('dealership_id', dealershipId)
      .ilike('plate', decoded)
      .order('created_at', { ascending: false }),
  ]);

  if (vinRes.error) console.error('[vehicles/[key]] vin query:', vinRes.error.message);
  if (plateRes.error) console.error('[vehicles/[key]] plate query:', plateRes.error.message);

  // Merge and deduplicate by order ID
  const seen    = new Set<number>();
  const merged  = [...(vinRes.data ?? []), ...(plateRes.data ?? [])].filter(
    (o: { id: number }) => { if (seen.has(o.id)) return false; seen.add(o.id); return true; }
  );

  // Sort by created_at descending (most recent first)
  merged.sort((a: { created_at: string }, b: { created_at: string }) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ orders: merged });
}
