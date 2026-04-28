// PUT  /api/testdrives/[id]
// DELETE /api/testdrives/[id]

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

const KEY_MAP: Record<string, string> = {
  customerName:        'customer_name',
  personnummer:        'personnummer',
  customerAddress:     'customer_address',
  customerPhone:       'customer_phone',
  customerEmail:       'customer_email',
  licenseNumber:       'license_number',
  licenseClass:        'license_class',
  vehicle:             'vehicle',
  vin:                 'vin',
  registrationNumber:  'registration_number',
  vehicleColor:        'vehicle_color',
  odometerBefore:      'odometer_before',
  odometerAfter:       'odometer_after',
  scheduledDate:       'scheduled_date',
  departureTime:       'departure_time',
  returnTime:          'return_time',
  route:               'route',
  insuranceCompany:    'insurance_company',
  insuranceFee:        'insurance_fee',
  preInspectionOk:     'pre_inspection_ok',
  preInspectionNotes:  'pre_inspection_notes',
  postInspectionNotes: 'post_inspection_notes',
  staffName:           'staff_name',
  driverSignature:     'driver_signature',
  staffSignature:      'staff_signature',
  status:              'status',
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;
    const { dealershipId, ...fields } = body;
    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    // Fields that must be NULL (not '') when empty — PostgreSQL TIME/DATE columns
    const nullIfEmpty = new Set(['scheduled_date', 'departure_time', 'return_time']);

    const patch: Record<string, unknown> = {};
    for (const [jsKey, dbKey] of Object.entries(KEY_MAP)) {
      if (jsKey in fields) {
        const val = fields[jsKey];
        patch[dbKey] = nullIfEmpty.has(dbKey)
          ? ((val as string) || null)
          : (val ?? null);
      }
    }

    const { data, error } = await sb()
      .from('test_drives')
      .update(patch)
      .eq('id', id)
      .eq('dealership_id', dealershipId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ testDrive: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    const { error } = await sb()
      .from('test_drives')
      .delete()
      .eq('id', id)
      .eq('dealership_id', dealershipId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
