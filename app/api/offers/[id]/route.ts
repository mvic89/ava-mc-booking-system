// ─── PUT    /api/offers/[id]  ───────────────────────────────────────────────
// ─── DELETE /api/offers/[id]  ───────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

/** Map raw DB row → camelCase offer object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOffer(r: any) {
  return {
    id:                 r.id,
    leadId:             r.lead_id,
    dealershipId:       r.dealership_id,
    offerNumber:        r.offer_number         ?? '',
    status:             r.status               ?? 'draft',
    customerName:       r.customer_name        ?? '',
    personnummer:       r.personnummer          ?? '',
    customerAddress:    r.customer_address     ?? '',
    customerPhone:      r.customer_phone       ?? '',
    customerEmail:      r.customer_email       ?? '',
    vehicle:            r.vehicle              ?? '',
    vehicleColor:       r.vehicle_color        ?? '',
    vehicleCondition:   r.vehicle_condition    ?? 'new',
    vin:                r.vin                  ?? '',
    registrationNumber: r.registration_number  ?? '',
    listPrice:          parseFloat(r.list_price       ?? '0') || 0,
    discount:           parseFloat(r.discount          ?? '0') || 0,
    accessories:        r.accessories          ?? '',
    accessoriesCost:    parseFloat(r.accessories_cost  ?? '0') || 0,
    tradeIn:            r.trade_in             ?? '',
    tradeInCredit:      parseFloat(r.trade_in_credit   ?? '0') || 0,
    totalPrice:         parseFloat(r.total_price       ?? '0') || 0,
    vatAmount:          parseFloat(r.vat_amount         ?? '0') || 0,
    paymentType:        r.payment_type         ?? 'cash',
    downPayment:        parseFloat(r.down_payment       ?? '0') || 0,
    financingMonths:    r.financing_months     ?? 36,
    financingMonthly:   parseFloat(r.financing_monthly  ?? '0') || 0,
    financingApr:       parseFloat(r.financing_apr       ?? '4.9') || 4.9,
    nominalRate:        parseFloat(r.nominal_rate        ?? '0') || 0,
    deliveryWeeks:      r.delivery_weeks       ?? 4,
    validUntil:         r.valid_until          ?? '',
    notes:              r.notes                ?? '',
    sellerSignature:    r.seller_signature     ?? '',
    buyerSignature:     r.buyer_signature      ?? '',
    createdAt:          r.created_at           ?? '',
    updatedAt:          r.updated_at           ?? '',
  };
}

const KEY_MAP: Record<string, string> = {
  status:             'status',
  customerName:       'customer_name',
  personnummer:       'personnummer',
  customerAddress:    'customer_address',
  customerPhone:      'customer_phone',
  customerEmail:      'customer_email',
  vehicle:            'vehicle',
  vehicleColor:       'vehicle_color',
  vehicleCondition:   'vehicle_condition',
  vin:                'vin',
  registrationNumber: 'registration_number',
  listPrice:          'list_price',
  discount:           'discount',
  accessories:        'accessories',
  accessoriesCost:    'accessories_cost',
  tradeIn:            'trade_in',
  tradeInCredit:      'trade_in_credit',
  totalPrice:         'total_price',
  vatAmount:          'vat_amount',
  paymentType:        'payment_type',
  downPayment:        'down_payment',
  financingMonths:    'financing_months',
  financingMonthly:   'financing_monthly',
  financingApr:       'financing_apr',
  nominalRate:        'nominal_rate',
  deliveryWeeks:      'delivery_weeks',
  validUntil:         'valid_until',
  notes:              'notes',
  sellerSignature:    'seller_signature',
  buyerSignature:     'buyer_signature',
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }    = await params;
    const body      = await req.json() as Record<string, unknown>;
    const { dealershipId, ...fields } = body;
    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    const nullIfEmpty = new Set(['valid_until']);
    const patch: Record<string, unknown> = {};
    for (const [jsKey, dbKey] of Object.entries(KEY_MAP)) {
      if (jsKey in fields) {
        const val = fields[jsKey];
        patch[dbKey] = nullIfEmpty.has(dbKey) ? ((val as string) || null) : (val ?? null);
      }
    }

    const { data, error } = await sb()
      .from('offers')
      .update(patch)
      .eq('id', id)
      .eq('dealership_id', dealershipId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ offer: toOffer(data) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }        = await params;
    const dealershipId  = req.nextUrl.searchParams.get('dealershipId');
    if (!dealershipId)
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

    const { error } = await sb()
      .from('offers')
      .delete()
      .eq('id', id)
      .eq('dealership_id', dealershipId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
