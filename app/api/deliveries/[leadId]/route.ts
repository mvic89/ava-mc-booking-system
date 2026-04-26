// GET  /api/deliveries/[leadId]  — fetch delivery record for a lead
// POST /api/deliveries/[leadId]  — upsert (create or update) delivery record

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId || !leadId) {
    return NextResponse.json({ error: 'Missing dealershipId or leadId' }, { status: 400 });
  }

  const { data, error } = await sb()
    .from('deliveries')
    .select('*')
    .eq('lead_id', Number(leadId))
    .eq('dealership_id', dealershipId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ delivery: data ?? null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const body = await req.json() as {
    dealershipId:   string;
    step:           string;
    inspection:     unknown[];
    documents:      unknown[];
    walkthrough:    unknown[];
    odometer:       string;
    fuelLevel:      string;
    damageNotes:    string;
    customerName:   string;
    salesperson:    string;
    deliveryTime:   string;
    customerSigned: boolean;
    dealerSigned:   boolean;
  };

  if (!body.dealershipId || !leadId) {
    return NextResponse.json({ error: 'Missing dealershipId or leadId' }, { status: 400 });
  }

  const isComplete = body.step === 'complete';
  const now = new Date().toISOString();

  const { data, error } = await sb()
    .from('deliveries')
    .upsert(
      {
        dealership_id:   body.dealershipId,
        lead_id:         Number(leadId),
        step:            body.step,
        inspection:      body.inspection,
        documents:       body.documents,
        walkthrough:     body.walkthrough,
        odometer:        body.odometer        ?? '',
        fuel_level:      body.fuelLevel       ?? '',
        damage_notes:    body.damageNotes     ?? '',
        customer_name:   body.customerName    ?? '',
        salesperson:     body.salesperson     ?? '',
        delivery_time:   body.deliveryTime    ? new Date(body.deliveryTime).toISOString() : null,
        customer_signed: body.customerSigned  ?? false,
        dealer_signed:   body.dealerSigned    ?? false,
        completed_at:    isComplete ? now : null,
        updated_at:      now,
      },
      { onConflict: 'lead_id' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify team when delivery is fully completed
  if (isComplete) {
    notify({
      dealershipId: body.dealershipId,
      type:         'customer',
      title:        'Leverans slutförd ✓',
      message:      `${body.customerName || 'Kund'} — leveransintyg signerat av båda parter`,
      href:         `/sales/leads/${leadId}/delivery`,
    });
  }

  return NextResponse.json({ delivery: data });
}
