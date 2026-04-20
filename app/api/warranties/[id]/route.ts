// PUT  /api/warranties/[id]
// DELETE /api/warranties/[id]

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await req.json() as Record<string, unknown>;

    // Map camelCase to snake_case
    const update: Record<string, unknown> = {};
    const map: Record<string, string> = {
      vehicleName: 'vehicle_name', vin: 'vin', registrationNr: 'registration_nr',
      type: 'type', provider: 'provider', policyNumber: 'policy_number',
      startDate: 'start_date', endDate: 'end_date', coverageAmount: 'coverage_amount',
      status: 'status', claimDate: 'claim_date', claimAmount: 'claim_amount',
      claimNotes: 'claim_notes', notes: 'notes',
    };
    for (const [k, v] of Object.entries(body)) {
      if (map[k]) update[map[k]] = v;
    }

    const { data, error } = await sb()
      .from('warranties')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ warranty: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await sb().from('warranties').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
