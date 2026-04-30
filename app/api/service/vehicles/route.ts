import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/vehicles?dealershipId=…[&search=vin_or_plate]
// Returns a list of unique vehicles that have work orders, with aggregate stats.
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  const search       = req.nextUrl.searchParams.get('search')?.trim().toUpperCase() ?? '';

  if (!dealershipId) return NextResponse.json({ vehicles: [] });

  let query = sb()
    .from('work_orders')
    .select('id,vehicle_name,plate,vin,customer_name,customer_phone,customer_id,status,total_cost,created_at,completed_at,description')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`plate.ilike.%${search}%,vin.ilike.%${search}%,vehicle_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = (data ?? []) as Array<{
    id: number; vehicle_name: string; plate: string; vin: string;
    customer_name: string; customer_phone: string; customer_id: number | null;
    status: string; total_cost: number; created_at: string; completed_at: string | null;
    description: string;
  }>;

  // Group by VIN (preferred) or plate as the vehicle key
  const map = new Map<string, {
    key: string; vin: string; plate: string; vehicleName: string;
    customerName: string; customerPhone: string; customerId: number | null;
    orderCount: number; totalSpent: number;
    lastServiceDate: string; lastStatus: string;
  }>();

  for (const o of orders) {
    const key = (o.vin && o.vin.length > 5 ? o.vin : null) ?? o.plate ?? `id-${o.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        vin:          o.vin ?? '',
        plate:        o.plate ?? '',
        vehicleName:  o.vehicle_name ?? '',
        customerName: o.customer_name ?? '',
        customerPhone:o.customer_phone ?? '',
        customerId:   o.customer_id,
        orderCount:   0,
        totalSpent:   0,
        lastServiceDate: o.created_at,
        lastStatus:   o.status,
      });
    }
    const v = map.get(key)!;
    v.orderCount++;
    v.totalSpent += o.total_cost ?? 0;
    if (o.created_at > v.lastServiceDate) {
      v.lastServiceDate = o.created_at;
      v.lastStatus      = o.status;
    }
  }

  const vehicles = Array.from(map.values()).sort(
    (a, b) => new Date(b.lastServiceDate).getTime() - new Date(a.lastServiceDate).getTime()
  );

  return NextResponse.json({ vehicles });
}
