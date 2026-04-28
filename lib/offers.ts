// ─── Offers — Supabase backing store ──────────────────────────────────────────
import { getSupabaseBrowser } from './supabase';
import { getDealershipId } from './tenant';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseBrowser() as any; }

export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'declined';
export type PaymentType = 'cash' | 'financing';
export type VehicleCondition = 'new' | 'used';
export type TradeInCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';

/** One additional vehicle line item in a multi-vehicle deal */
export interface VehicleLineItem {
  id:                 string;   // client-side stable key (crypto.randomUUID)
  vehicle:            string;
  vehicleColor:       string;
  vehicleCondition:   VehicleCondition;
  vin:                string;
  registrationNumber: string;
  listPrice:          number;
  discount:           number;
}

/** Structured trade-in appraisal data */
export interface TradeInData {
  make:               string;
  model:              string;
  year:               number;
  mileage:            number;
  mileageUnit:        'mil' | 'km';
  condition:          TradeInCondition;
  color:              string;
  vin:                string;
  registrationNumber?: string;   // Swedish reg plate looked up at time of appraisal
  notes:              string;
  estimatedValue:     number;    // dealer internal estimate
  offeredCredit:      number;    // credit applied to the deal (→ tradeInCredit)
  // Owner + lien data from Bilvision (optional, captured at lookup time)
  ownerName?:         string;
  ownerCity?:         string;
  liens?:             boolean;   // true = outstanding credit on the vehicle
  vehicleStatus?:     string;    // 'REGISTERED' | 'STOLEN' | 'SCRAPPED' | 'DEREGISTERED'
  lastInspection?:    string;    // ISO date
  nextInspection?:    string;    // ISO date
  fuelType?:          string;
  engineCC?:          number;
}

export interface Offer {
  id:                 number;
  leadId:             number;
  dealershipId:       string;
  offerNumber:        string;
  status:             OfferStatus;
  // Customer snapshot
  customerName:       string;
  personnummer:       string;
  customerAddress:    string;
  customerPhone:      string;
  customerEmail:      string;
  // Vehicle
  vehicle:            string;
  vehicleColor:       string;
  vehicleCondition:   VehicleCondition;
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
  paymentType:        PaymentType;
  downPayment:        number;
  financingMonths:    number;
  financingMonthly:   number;
  financingApr:       number;
  nominalRate:        number;
  // Delivery & meta
  deliveryWeeks:      number;
  validUntil:         string;
  notes:              string;
  // BankID signatures (JSON SigProof or '')
  sellerSignature:    string;
  buyerSignature:     string;
  // Multi-vehicle & structured trade-in
  extraVehicles:      VehicleLineItem[];
  tradeInData:        TradeInData | null;
  createdAt:          string;
  updatedAt:          string;
}

export type OfferInput = Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>;

// ── Column mapping ─────────────────────────────────────────────────────────────

function mapDbToOffer(row: Record<string, unknown>): Offer {
  return {
    id:                 row.id                  as number,
    leadId:             row.lead_id             as number,
    dealershipId:       row.dealership_id       as string,
    offerNumber:        row.offer_number        as string,
    status:             (row.status             as OfferStatus) ?? 'draft',
    customerName:       (row.customer_name      as string) ?? '',
    personnummer:       (row.personnummer        as string) ?? '',
    customerAddress:    (row.customer_address   as string) ?? '',
    customerPhone:      (row.customer_phone     as string) ?? '',
    customerEmail:      (row.customer_email     as string) ?? '',
    vehicle:            (row.vehicle            as string) ?? '',
    vehicleColor:       (row.vehicle_color      as string) ?? '',
    vehicleCondition:   (row.vehicle_condition  as VehicleCondition) ?? 'new',
    vin:                (row.vin                as string) ?? '',
    registrationNumber: (row.registration_number as string) ?? '',
    listPrice:          parseFloat(String(row.list_price       ?? '0')) || 0,
    discount:           parseFloat(String(row.discount         ?? '0')) || 0,
    accessories:        (row.accessories        as string) ?? '',
    accessoriesCost:    parseFloat(String(row.accessories_cost ?? '0')) || 0,
    tradeIn:            (row.trade_in           as string) ?? '',
    tradeInCredit:      parseFloat(String(row.trade_in_credit  ?? '0')) || 0,
    totalPrice:         parseFloat(String(row.total_price      ?? '0')) || 0,
    vatAmount:          parseFloat(String(row.vat_amount        ?? '0')) || 0,
    paymentType:        (row.payment_type       as PaymentType) ?? 'cash',
    downPayment:        parseFloat(String(row.down_payment      ?? '0')) || 0,
    financingMonths:    (row.financing_months   as number) ?? 36,
    financingMonthly:   parseFloat(String(row.financing_monthly ?? '0')) || 0,
    financingApr:       parseFloat(String(row.financing_apr     ?? '4.9')) || 4.9,
    nominalRate:        parseFloat(String(row.nominal_rate      ?? '0')) || 0,
    deliveryWeeks:      (row.delivery_weeks     as number) ?? 4,
    validUntil:         (row.valid_until        as string) ?? '',
    notes:              (row.notes              as string) ?? '',
    sellerSignature:    (row.seller_signature   as string) ?? '',
    buyerSignature:     (row.buyer_signature    as string) ?? '',
    extraVehicles:      (() => {
      const raw = row.extra_vehicles;
      if (!raw) return [];
      try { return Array.isArray(raw) ? raw as VehicleLineItem[] : JSON.parse(raw as string) as VehicleLineItem[]; }
      catch { return []; }
    })(),
    tradeInData:        (() => {
      const raw = row.trade_in_data;
      if (!raw) return null;
      try { return (typeof raw === 'string' ? JSON.parse(raw) : raw) as TradeInData; }
      catch { return null; }
    })(),
    createdAt:          (row.created_at         as string) ?? '',
    updatedAt:          (row.updated_at         as string) ?? '',
  };
}

function mapOfferToDb(o: OfferInput): Record<string, unknown> {
  return {
    lead_id:             o.leadId,
    dealership_id:       o.dealershipId,
    offer_number:        o.offerNumber,
    status:              o.status,
    customer_name:       o.customerName,
    personnummer:        o.personnummer,
    customer_address:    o.customerAddress,
    customer_phone:      o.customerPhone,
    customer_email:      o.customerEmail,
    vehicle:             o.vehicle,
    vehicle_color:       o.vehicleColor,
    vehicle_condition:   o.vehicleCondition,
    vin:                 o.vin,
    registration_number: o.registrationNumber,
    list_price:          o.listPrice,
    discount:            o.discount,
    accessories:         o.accessories,
    accessories_cost:    o.accessoriesCost,
    trade_in:            o.tradeIn,
    trade_in_credit:     o.tradeInCredit,
    total_price:         o.totalPrice,
    vat_amount:          o.vatAmount,
    payment_type:        o.paymentType,
    down_payment:        o.downPayment,
    financing_months:    o.financingMonths,
    financing_monthly:   o.financingMonthly,
    financing_apr:       o.financingApr,
    nominal_rate:        o.nominalRate,
    delivery_weeks:      o.deliveryWeeks,
    valid_until:         o.validUntil || null,
    notes:               o.notes,
    seller_signature:    o.sellerSignature ?? '',
    buyer_signature:     o.buyerSignature  ?? '',
    extra_vehicles:      JSON.stringify(o.extraVehicles ?? []),
    trade_in_data:       o.tradeInData ? JSON.stringify(o.tradeInData) : null,
  };
}

// ── Offer number generator ─────────────────────────────────────────────────────

export function generateOfferNumber(): string {
  const year = new Date().getFullYear();
  const seq  = String(Math.floor(Math.random() * 9000) + 1000);
  return `OFR-${year}-${seq}`;
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getOfferByLeadId(leadId: number): Promise<Offer | null> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return null;
  const { data, error } = await db()
    .from('offers')
    .select('*')
    .eq('lead_id', leadId)
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('[offers] getOfferByLeadId:', error.message); return null; }
  return data ? mapDbToOffer(data) : null;
}

export async function getOfferById(id: number): Promise<Offer | null> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return null;
  const { data, error } = await db()
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('dealership_id', dealershipId)
    .maybeSingle();
  if (error) { console.error('[offers] getOfferById:', error.message); return null; }
  return data ? mapDbToOffer(data) : null;
}

// ── Write ──────────────────────────────────────────────────────────────────────

export async function createOffer(input: OfferInput): Promise<Offer | null> {
  const { data, error } = await db()
    .from('offers')
    .insert(mapOfferToDb(input))
    .select()
    .single();
  if (error) { console.error('[offers] createOffer:', error.message); return null; }
  return mapDbToOffer(data);
}

export async function updateOffer(id: number, input: Partial<OfferInput>): Promise<Offer | null> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return null;
  // Build partial DB object — only include defined keys
  const patch: Record<string, unknown> = {};
  if (input.status             !== undefined) patch.status              = input.status;
  if (input.customerName       !== undefined) patch.customer_name       = input.customerName;
  if (input.personnummer       !== undefined) patch.personnummer         = input.personnummer;
  if (input.customerAddress    !== undefined) patch.customer_address    = input.customerAddress;
  if (input.customerPhone      !== undefined) patch.customer_phone      = input.customerPhone;
  if (input.customerEmail      !== undefined) patch.customer_email      = input.customerEmail;
  if (input.vehicle            !== undefined) patch.vehicle             = input.vehicle;
  if (input.vehicleColor       !== undefined) patch.vehicle_color       = input.vehicleColor;
  if (input.vehicleCondition   !== undefined) patch.vehicle_condition   = input.vehicleCondition;
  if (input.vin                !== undefined) patch.vin                 = input.vin;
  if (input.registrationNumber !== undefined) patch.registration_number = input.registrationNumber;
  if (input.listPrice          !== undefined) patch.list_price          = input.listPrice;
  if (input.discount           !== undefined) patch.discount            = input.discount;
  if (input.accessories        !== undefined) patch.accessories         = input.accessories;
  if (input.accessoriesCost    !== undefined) patch.accessories_cost    = input.accessoriesCost;
  if (input.tradeIn            !== undefined) patch.trade_in            = input.tradeIn;
  if (input.tradeInCredit      !== undefined) patch.trade_in_credit     = input.tradeInCredit;
  if (input.totalPrice         !== undefined) patch.total_price         = input.totalPrice;
  if (input.vatAmount          !== undefined) patch.vat_amount          = input.vatAmount;
  if (input.paymentType        !== undefined) patch.payment_type        = input.paymentType;
  if (input.downPayment        !== undefined) patch.down_payment        = input.downPayment;
  if (input.financingMonths    !== undefined) patch.financing_months    = input.financingMonths;
  if (input.financingMonthly   !== undefined) patch.financing_monthly   = input.financingMonthly;
  if (input.financingApr       !== undefined) patch.financing_apr       = input.financingApr;
  if (input.nominalRate        !== undefined) patch.nominal_rate        = input.nominalRate;
  if (input.deliveryWeeks      !== undefined) patch.delivery_weeks      = input.deliveryWeeks;
  if (input.validUntil         !== undefined) patch.valid_until         = input.validUntil || null;
  if (input.notes              !== undefined) patch.notes               = input.notes;
  if (input.sellerSignature    !== undefined) patch.seller_signature    = input.sellerSignature;
  if (input.buyerSignature     !== undefined) patch.buyer_signature     = input.buyerSignature;

  const { data, error } = await db()
    .from('offers')
    .update(patch)
    .eq('id', id)
    .eq('dealership_id', dealershipId)
    .select()
    .single();
  if (error) { console.error('[offers] updateOffer:', error.message); return null; }
  return mapDbToOffer(data);
}
