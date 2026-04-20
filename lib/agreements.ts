// ─── Agreements store — Supabase backing store ─────────────────────────────────
import { getSupabaseBrowser } from './supabase';
import { getDealershipId } from './tenant';

export interface Agreement {
  id:                 number;
  dealershipId:       string;
  leadId:             number | null;
  offerId:            number | null;
  customerId:         number | null;

  agreementNumber:    string;
  status:             'draft' | 'sent' | 'signed' | 'completed' | 'cancelled';

  // Customer snapshot
  customerName:       string;
  personnummer:       string;
  customerAddress:    string;
  customerPhone:      string;
  customerEmail:      string;

  // Vehicle snapshot
  vehicle:            string;
  vehicleColor:       string;
  vehicleCondition:   string;
  vin:                string;
  registrationNumber: string;

  // Pricing
  listPrice:          number;
  discount:           number;
  accessories:        string;
  accessoriesCost:    number;
  tradeIn:            string;
  tradeInCredit:      number;
  totalPrice:         number;
  vatAmount:          number;

  // Payment
  paymentType:        string;
  downPayment:        number;
  financingMonths:    number;
  financingMonthly:   number;
  financingApr:       number;
  nominalRate:        number;

  // Delivery
  deliveryWeeks:      number;
  validUntil:         string | null;
  notes:              string;

  // Signatures
  sellerName:         string;
  sellerSignature:    string;
  buyerSignature:     string;
  signedAt:           string | null;

  createdAt:          string;
  updatedAt:          string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, unknown>): Agreement {
  return {
    id:                 row.id                  as number,
    dealershipId:       row.dealership_id       as string,
    leadId:             row.lead_id             as number | null,
    offerId:            row.offer_id            as number | null,
    customerId:         row.customer_id         as number | null,
    agreementNumber:    (row.agreement_number   as string) ?? '',
    status:             (row.status             as Agreement['status']) ?? 'draft',
    customerName:       (row.customer_name      as string) ?? '',
    personnummer:       (row.personnummer        as string) ?? '',
    customerAddress:    (row.customer_address   as string) ?? '',
    customerPhone:      (row.customer_phone     as string) ?? '',
    customerEmail:      (row.customer_email     as string) ?? '',
    vehicle:            (row.vehicle            as string) ?? '',
    vehicleColor:       (row.vehicle_color      as string) ?? '',
    vehicleCondition:   (row.vehicle_condition  as string) ?? 'new',
    vin:                (row.vin                as string) ?? '',
    registrationNumber: (row.registration_number as string) ?? '',
    listPrice:          parseFloat(String(row.list_price      ?? '0')),
    discount:           parseFloat(String(row.discount        ?? '0')),
    accessories:        (row.accessories        as string) ?? '',
    accessoriesCost:    parseFloat(String(row.accessories_cost ?? '0')),
    tradeIn:            (row.trade_in           as string) ?? '',
    tradeInCredit:      parseFloat(String(row.trade_in_credit  ?? '0')),
    totalPrice:         parseFloat(String(row.total_price      ?? '0')),
    vatAmount:          parseFloat(String(row.vat_amount       ?? '0')),
    paymentType:        (row.payment_type       as string) ?? 'cash',
    downPayment:        parseFloat(String(row.down_payment     ?? '0')),
    financingMonths:    (row.financing_months   as number) ?? 36,
    financingMonthly:   parseFloat(String(row.financing_monthly ?? '0')),
    financingApr:       parseFloat(String(row.financing_apr    ?? '0')),
    nominalRate:        parseFloat(String(row.nominal_rate     ?? '0')),
    deliveryWeeks:      (row.delivery_weeks     as number) ?? 4,
    validUntil:         (row.valid_until        as string | null) ?? null,
    notes:              (row.notes              as string) ?? '',
    sellerName:         (row.seller_name        as string) ?? '',
    sellerSignature:    (row.seller_signature   as string) ?? '',
    buyerSignature:     (row.buyer_signature    as string) ?? '',
    signedAt:           (row.signed_at          as string | null) ?? null,
    createdAt:          (row.created_at         as string) ?? new Date().toISOString(),
    updatedAt:          (row.updated_at         as string) ?? new Date().toISOString(),
  };
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getAgreements(): Promise<Agreement[]> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return [];
  try {
    const res = await fetch(`/api/agreements/list?dealershipId=${encodeURIComponent(dealershipId)}`);
    if (!res.ok) {
      console.error('[agreements] getAgreements HTTP', res.status);
      return [];
    }
    const json = await res.json() as { agreements?: unknown[] };
    return (json.agreements ?? []).map(r => mapRow(r as Record<string, unknown>));
  } catch (err) {
    console.error('[agreements] getAgreements:', err);
    return [];
  }
}

export async function getAgreementByOffer(offerId: number): Promise<Agreement | null> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseBrowser() as any;
  const { data, error } = await sb
    .from('agreements')
    .select('*')
    .eq('offer_id', offerId)
    .eq('dealership_id', dealershipId)
    .maybeSingle();
  if (error) { console.error('[agreements] getAgreementByOffer:', error.message); return null; }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

// ── Upsert (via server route to bypass RLS) ───────────────────────────────────

export interface UpsertAgreementPayload {
  dealershipId:       string;
  leadId?:            number | null;
  offerId?:           number | null;
  customerId?:        number | null;
  agreementNumber:    string;
  status:             Agreement['status'];
  customerName?:      string;
  personnummer?:      string;
  customerAddress?:   string;
  customerPhone?:     string;
  customerEmail?:     string;
  vehicle?:           string;
  vehicleColor?:      string;
  vehicleCondition?:  string;
  vin?:               string;
  registrationNumber?: string;
  listPrice?:         number;
  discount?:          number;
  accessories?:       string;
  accessoriesCost?:   number;
  tradeIn?:           string;
  tradeInCredit?:     number;
  totalPrice?:        number;
  vatAmount?:         number;
  paymentType?:       string;
  downPayment?:       number;
  financingMonths?:   number;
  financingMonthly?:  number;
  financingApr?:      number;
  nominalRate?:       number;
  deliveryWeeks?:     number;
  validUntil?:        string;
  notes?:             string;
  sellerName?:        string;
  sellerSignature?:   string;
  buyerSignature?:    string;
  signedAt?:          string;
}

export async function upsertAgreement(payload: UpsertAgreementPayload): Promise<Agreement> {
  const res = await fetch('/api/agreements/upsert', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'upsertAgreement failed');
  }
  const json = await res.json() as { agreement: Record<string, unknown> };
  return mapRow(json.agreement);
}
