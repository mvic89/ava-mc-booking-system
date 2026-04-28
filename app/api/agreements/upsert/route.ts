// ─── POST /api/agreements/upsert ───────────────────────────────────────────────
// Creates or updates a purchase agreement using the service-role key so RLS
// never blocks the write. Upsert is keyed on (agreement_number, dealership_id).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const dealershipId    = body.dealershipId    as string | undefined;
  const agreementNumber = body.agreementNumber as string | undefined;

  if (!dealershipId || !agreementNumber) {
    return NextResponse.json({ error: 'dealershipId and agreementNumber are required' }, { status: 400 });
  }

  // Map camelCase payload → snake_case DB columns
  const row: Record<string, unknown> = {
    dealership_id:       dealershipId,
    agreement_number:    agreementNumber,
    status:              body.status              ?? 'draft',
    lead_id:             body.leadId              ?? null,
    offer_id:            body.offerId             ?? null,
    customer_id:         body.customerId          ?? null,
    customer_name:       body.customerName        ?? '',
    personnummer:        body.personnummer         ?? '',
    customer_address:    body.customerAddress     ?? '',
    customer_phone:      body.customerPhone       ?? '',
    customer_email:      body.customerEmail       ?? '',
    vehicle:             body.vehicle             ?? '',
    vehicle_color:       body.vehicleColor        ?? '',
    vehicle_condition:   body.vehicleCondition    ?? 'new',
    vin:                 body.vin                 ?? '',
    registration_number: body.registrationNumber  ?? '',
    list_price:          body.listPrice           ?? 0,
    discount:            body.discount            ?? 0,
    accessories:         body.accessories         ?? '',
    accessories_cost:    body.accessoriesCost     ?? 0,
    trade_in:            body.tradeIn             ?? '',
    trade_in_credit:     body.tradeInCredit       ?? 0,
    total_price:         body.totalPrice          ?? 0,
    vat_amount:          body.vatAmount           ?? 0,
    payment_type:        body.paymentType         ?? 'cash',
    down_payment:        body.downPayment         ?? 0,
    financing_months:    body.financingMonths     ?? 36,
    financing_monthly:   body.financingMonthly    ?? 0,
    financing_apr:       body.financingApr        ?? 4.9,
    nominal_rate:        body.nominalRate         ?? 0,
    delivery_weeks:      body.deliveryWeeks       ?? 4,
    valid_until:         body.validUntil          || null,
    notes:               body.notes               ?? '',
    seller_name:         body.sellerName          ?? '',
    seller_signature:    body.sellerSignature     ?? '',
    buyer_signature:     body.buyerSignature      ?? '',
    signed_at:           body.signedAt            || null,
  };

  const { data, error } = await sb()
    .from('agreements')
    .upsert(row, { onConflict: 'agreement_number,dealership_id' })
    .select()
    .single();

  if (error) {
    console.error('[api/agreements/upsert]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify when an agreement is signed (buyer_signature just set)
  if (body.buyerSignature && body.status === 'signed') {
    const totalStr = Math.round((body.totalPrice as number) || 0).toLocaleString('sv-SE');
    notify({
      dealershipId,
      type:    'agreement',
      title:   'Köpeavtal signerat',
      message: `${body.customerName || 'Kund'} — ${body.vehicle || ''} — ${totalStr} kr`,
      href:    body.leadId ? `/sales/leads/${body.leadId}/agreement` : '/sales/leads',
    });
  }

  return NextResponse.json({ agreement: data });
}
