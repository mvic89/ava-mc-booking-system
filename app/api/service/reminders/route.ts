import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// GET /api/service/reminders?dealershipId=…
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ reminders: [] });

  const { data, error } = await sb()
    .from('service_reminders')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('next_reminder_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data ?? [] });
}

// POST /api/service/reminders — create a new reminder
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dealershipId, customerId, customerName, customerEmail, customerPhone,
      vehicleName, plate, vin, intervalMonths, lastServiceAt, notes,
    } = body;

    if (!dealershipId || !customerName || !intervalMonths) {
      return NextResponse.json({ error: 'dealershipId, customerName, intervalMonths required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const lastService = lastServiceAt ?? new Date().toISOString().slice(0, 10);
    const nextReminder = addMonths(lastService, Number(intervalMonths));

    const { data, error } = await sb()
      .from('service_reminders')
      .insert({
        dealership_id:    dealershipId,
        customer_id:      customerId ?? null,
        customer_name:    customerName,
        customer_email:   customerEmail ?? '',
        customer_phone:   customerPhone ?? '',
        vehicle_name:     vehicleName ?? '',
        plate:            plate ?? '',
        vin:              vin ?? '',
        interval_months:  Number(intervalMonths),
        last_service_at:  lastService,
        next_reminder_at: nextReminder,
        last_sent_at:     null,
        status:           'active',
        notes:            notes ?? '',
        created_at:       now,
        updated_at:       now,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reminder: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
