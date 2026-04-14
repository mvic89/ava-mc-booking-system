// GET /api/testdrives?leadId=X&dealershipId=Y
// POST /api/testdrives

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(req: NextRequest) {
  try {
    const leadId       = req.nextUrl.searchParams.get('leadId');
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!leadId || !dealershipId)
      return NextResponse.json({ error: 'Missing leadId or dealershipId' }, { status: 400 });

    const { data, error } = await sb()
      .from('test_drives')
      .select('*')
      .eq('lead_id', leadId)
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/testdrives]', error.message, error.code);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
    return NextResponse.json({ testDrive: data ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { dealershipId, leadId, ...fields } = body;
    if (!dealershipId || !leadId)
      return NextResponse.json({ error: 'Missing dealershipId or leadId' }, { status: 400 });

    const row = {
      lead_id:               leadId,
      dealership_id:         dealershipId,
      customer_name:         fields.customerName       ?? '',
      personnummer:          fields.personnummer        ?? '',
      customer_address:      fields.customerAddress    ?? '',
      customer_phone:        fields.customerPhone      ?? '',
      customer_email:        fields.customerEmail      ?? '',
      license_number:        fields.licenseNumber      ?? '',
      license_class:         fields.licenseClass       ?? 'A',
      vehicle:               fields.vehicle            ?? '',
      vin:                   fields.vin                ?? '',
      registration_number:   fields.registrationNumber ?? '',
      vehicle_color:         fields.vehicleColor       ?? '',
      odometer_before:       fields.odometerBefore     ?? 0,
      odometer_after:        fields.odometerAfter      ?? null,
      scheduled_date:        (fields.scheduledDate  as string) || null,
      departure_time:        (fields.departureTime  as string) || null,
      return_time:           (fields.returnTime     as string) || null,
      route:                 fields.route              ?? '',
      insurance_company:     fields.insuranceCompany   ?? '',
      insurance_fee:         fields.insuranceFee       ?? 0,
      pre_inspection_ok:     fields.preInspectionOk    ?? true,
      pre_inspection_notes:  fields.preInspectionNotes ?? '',
      post_inspection_notes: fields.postInspectionNotes ?? '',
      staff_name:            fields.staffName          ?? '',
      driver_signature:      fields.driverSignature    ?? '',
      staff_signature:       fields.staffSignature     ?? '',
      status:                fields.status             ?? 'scheduled',
    };

    const { data, error } = await sb()
      .from('test_drives')
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ testDrive: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
