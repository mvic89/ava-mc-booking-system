// ─── PUT    /api/offers/[id]  ───────────────────────────────────────────────
// ─── DELETE /api/offers/[id]  ───────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

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
    extraVehicles:      (() => { try { const v = r.extra_vehicles; return Array.isArray(v) ? v : JSON.parse(v ?? '[]'); } catch { return []; } })(),
    tradeInData:        (() => { try { const v = r.trade_in_data; return v ? (typeof v === 'string' ? JSON.parse(v) : v) : null; } catch { return null; } })(),
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
  extraVehicles:      'extra_vehicles',
  tradeInData:        'trade_in_data',
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
    const jsonFields  = new Set(['extra_vehicles', 'trade_in_data']);
    const patch: Record<string, unknown> = {};
    for (const [jsKey, dbKey] of Object.entries(KEY_MAP)) {
      if (jsKey in fields) {
        const val = fields[jsKey];
        if (jsonFields.has(dbKey)) {
          // Serialize arrays/objects to JSON string; null/undefined → null
          patch[dbKey] = val == null ? null
            : typeof val === 'string' ? val
            : JSON.stringify(val);
        } else {
          patch[dbKey] = nullIfEmpty.has(dbKey) ? ((val as string) || null) : (val ?? null);
        }
      }
    }

    // Special case: tradeIns array takes precedence over tradeInData for trade_in_data column
    if ('tradeIns' in fields) {
      const arr = fields.tradeIns;
      if (Array.isArray(arr) && arr.length > 0) {
        patch['trade_in_data'] = JSON.stringify(arr);
      } else if (arr && typeof arr === 'string') {
        patch['trade_in_data'] = arr;
      } else {
        patch['trade_in_data'] = null;
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
    const offer = toOffer(data);

    // Notify on meaningful status transitions
    if ('status' in patch) {
      const totalStr = Math.round(offer.totalPrice).toLocaleString('sv-SE');
      if (patch.status === 'sent') {
        notify({
          dealershipId: dealershipId as string,
          type:    'agreement',
          title:   'Offert skickad',
          message: `${offer.customerName || 'Kund'} — ${offer.vehicle} — ${totalStr} kr`,
          href:    `/sales/leads/${offer.leadId}/offer`,
        });
      } else if (patch.status === 'accepted') {
        notify({
          dealershipId: dealershipId as string,
          type:    'payment',
          title:   'Offert accepterad',
          message: `${offer.customerName || 'Kund'} — ${offer.vehicle} — ${totalStr} kr`,
          href:    `/sales/leads/${offer.leadId}/offer`,
        });
      } else if (patch.status === 'declined') {
        notify({
          dealershipId: dealershipId as string,
          type:    'lead',
          title:   'Offert avböjd',
          message: `${offer.customerName || 'Kund'} — ${offer.vehicle}`,
          href:    `/sales/leads/${offer.leadId}/offer`,
        });
      }
    }

    return NextResponse.json({ offer });
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
