// ─── GET /api/offers?leadId=123&dealershipId=Y  ─────────────────────────────
// ─── POST /api/offers                           ─────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateOfferNumber } from '@/lib/offers';
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

export async function GET(req: NextRequest) {
  try {
    const leadId       = req.nextUrl.searchParams.get('leadId');
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    if (!leadId || !dealershipId) {
      return NextResponse.json({ error: 'Missing leadId or dealershipId' }, { status: 400 });
    }
    const { data, error } = await sb()
      .from('offers')
      .select('*')
      .eq('lead_id', leadId)
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ offer: data ? toOffer(data) : null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealershipId, leadId, ...fields } = body as Record<string, unknown>;
    if (!dealershipId || !leadId) {
      return NextResponse.json({ error: 'Missing dealershipId or leadId' }, { status: 400 });
    }
    const row = {
      lead_id:             leadId,
      dealership_id:       dealershipId,
      offer_number:        fields.offerNumber         ?? generateOfferNumber(),
      status:              fields.status              ?? 'draft',
      customer_name:       fields.customerName        ?? '',
      personnummer:        fields.personnummer         ?? '',
      customer_address:    fields.customerAddress     ?? '',
      customer_phone:      fields.customerPhone       ?? '',
      customer_email:      fields.customerEmail       ?? '',
      vehicle:             fields.vehicle             ?? '',
      vehicle_color:       fields.vehicleColor        ?? '',
      vehicle_condition:   fields.vehicleCondition    ?? 'new',
      vin:                 fields.vin                 ?? '',
      registration_number: fields.registrationNumber  ?? '',
      list_price:          fields.listPrice           ?? 0,
      discount:            fields.discount            ?? 0,
      accessories:         fields.accessories         ?? '',
      accessories_cost:    fields.accessoriesCost     ?? 0,
      trade_in:            fields.tradeIn             ?? '',
      trade_in_credit:     fields.tradeInCredit       ?? 0,
      total_price:         fields.totalPrice          ?? 0,
      vat_amount:          fields.vatAmount           ?? 0,
      payment_type:        fields.paymentType         ?? 'cash',
      down_payment:        fields.downPayment         ?? 0,
      financing_months:    fields.financingMonths     ?? 36,
      financing_monthly:   fields.financingMonthly    ?? 0,
      financing_apr:       fields.financingApr        ?? 4.9,
      nominal_rate:        fields.nominalRate         ?? 0,
      delivery_weeks:      fields.deliveryWeeks       ?? 4,
      valid_until:         fields.validUntil          ?? null,
      notes:               fields.notes               ?? '',
      seller_signature:    fields.sellerSignature     ?? '',
      buyer_signature:     fields.buyerSignature      ?? '',
      extra_vehicles:      typeof fields.extraVehicles === 'string' ? fields.extraVehicles : JSON.stringify(fields.extraVehicles ?? []),
      // tradeIns (array) takes precedence over legacy tradeInData (single object)
      trade_in_data: (() => {
        const arr = fields.tradeIns;
        if (Array.isArray(arr) && arr.length > 0) return JSON.stringify(arr);
        if (arr && typeof arr === 'string') return arr;
        const single = fields.tradeInData;
        if (!single) return null;
        return typeof single === 'string' ? single : JSON.stringify(single);
      })(),
    };
    const { data, error } = await sb()
      .from('offers')
      .insert(row)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const offer = toOffer(data);
    const totalStr = Math.round(offer.totalPrice).toLocaleString('sv-SE');
    notify({
      dealershipId: dealershipId as string,
      type:    'agreement',
      title:   'Ny offert skapad',
      message: `${offer.customerName || 'Kund'} — ${offer.vehicle} — ${totalStr} kr`,
      href:    `/sales/leads/${leadId}/offer`,
    });
    return NextResponse.json({ offer }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
