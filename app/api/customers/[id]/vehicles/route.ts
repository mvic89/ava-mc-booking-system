// GET /api/customers/[id]/vehicles?dealershipId=…
// Returns all vehicles connected to a customer, sourced from:
//   1. Paid invoices (motorcycles they bought from this dealership)
//   2. Previous service/work orders (bikes serviced here, even if bought elsewhere)
// Deduplicates by normalised vehicle name so the same bike isn't listed twice.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export interface CustomerVehicle {
  id:          string;   // synthetic key
  name:        string;   // e.g. "Honda CB500F 2022"
  plate:       string;
  vin:         string;
  source:      'purchase' | 'service'; // where the record came from
  lastSeen:    string;   // ISO date — most recent invoice/order date
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId || !id) {
    return NextResponse.json({ vehicles: [] });
  }

  const customerId = Number(id);

  // 1. Vehicles from paid invoices (purchased here)
  const { data: invoiceRows } = await sb()
    .from('invoices')
    .select('vehicle, issue_date')
    .eq('customer_id', customerId)
    .eq('dealership_id', dealershipId)
    .eq('status', 'paid')
    .not('vehicle', 'is', null)
    .not('vehicle', 'eq', '')
    .order('issue_date', { ascending: false });

  // 2. Vehicles from work orders serviced here
  const { data: orderRows } = await sb()
    .from('work_orders')
    .select('vehicle_name, plate, vin, created_at')
    .eq('customer_id', customerId)
    .eq('dealership_id', dealershipId)
    .not('vehicle_name', 'is', null)
    .not('vehicle_name', 'eq', '')
    .order('created_at', { ascending: false });

  // Build deduped map keyed by normalised name
  const map = new Map<string, CustomerVehicle>();

  for (const row of (invoiceRows ?? [])) {
    const name = (row.vehicle as string).trim();
    const key  = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        id:       `inv-${key}`,
        name,
        plate:    '',
        vin:      '',
        source:   'purchase',
        lastSeen: row.issue_date as string,
      });
    }
  }

  for (const row of (orderRows ?? [])) {
    const name = (row.vehicle_name as string).trim();
    const key  = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        id:       `wo-${key}`,
        name,
        plate:    (row.plate as string) || '',
        vin:      (row.vin   as string) || '',
        source:   'service',
        lastSeen: row.created_at as string,
      });
    } else {
      // Enrich existing purchase record with plate/vin from service history
      const existing = map.get(key)!;
      if (!existing.plate && row.plate) existing.plate = row.plate as string;
      if (!existing.vin   && row.vin)   existing.vin   = row.vin   as string;
    }
  }

  const vehicles = Array.from(map.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  );

  return NextResponse.json({ vehicles });
}
