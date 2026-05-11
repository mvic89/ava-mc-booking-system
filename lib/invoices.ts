// ─── Invoice store — Supabase backing store ───────────────────────────────────
import { getSupabaseBrowser } from './supabase';
import { getDealershipId } from './tenant';
import type { VatScheme, InvoiceLine } from './vat';

export interface InvoicePart {
  name:       string;
  quantity:   number;
  unit_cost:  number;
  total_cost: number;
  part_number?: string;
}

export interface Invoice {
  id:            string;   // INV-YYYY-NNN or SRV-YYYY-NNN
  leadId:        string;
  customerId?:   number;
  customerName:  string;
  vehicle:       string;
  agreementRef:  string;
  totalAmount:   number;
  vatAmount:     number;
  netAmount:     number;
  paymentMethod: string;
  status:        'paid' | 'pending';
  issueDate:     string;
  paidDate?:     string;
  parts?:        InvoicePart[];   // spare parts / accessories (service invoices)
  // VAT / Moms fields
  vatScheme:     VatScheme;       // 'normal' | 'margin' | 'exempt'
  purchasePrice: number;          // dealer cost — used in margin scheme calculation
  marginAmount:  number;          // selling − purchase (margin scheme)
  currencyCode:  string;          // SEK | EUR | JPY etc.
  currencyRate:  number;          // rate to SEK at purchase time
  lines?:        InvoiceLine[];   // per-line VAT breakdown (mixed new/used orders)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseBrowser() as any; }

// ── Column mapping ─────────────────────────────────────────────────────────────

function mapDbToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id:            row.id            as string,
    leadId:        String(row.lead_id ?? ''),
    customerId:    row.customer_id != null ? Number(row.customer_id) : undefined,
    customerName:  (row.customer_name  as string) ?? '',
    vehicle:       (row.vehicle        as string) ?? '',
    agreementRef:  (row.agreement_ref  as string) ?? '',
    totalAmount:   parseFloat(String(row.total_amount ?? '0')),
    vatAmount:     parseFloat(String(row.vat_amount   ?? '0')),
    netAmount:     parseFloat(String(row.net_amount   ?? '0')),
    paymentMethod: (row.payment_method as string) ?? '',
    status:        (row.status         as 'paid' | 'pending') ?? 'pending',
    issueDate:     (row.issue_date     as string) ?? new Date().toISOString(),
    paidDate:      (row.paid_date      as string) ?? undefined,
    parts:         Array.isArray(row.parts) ? (row.parts as InvoicePart[]) : undefined,
    vatScheme:     ((row.vat_scheme    as VatScheme) ?? 'normal'),
    purchasePrice: parseFloat(String(row.purchase_price ?? '0')),
    marginAmount:  parseFloat(String(row.margin_amount  ?? '0')),
    currencyCode:  (row.currency_code  as string) ?? 'SEK',
    currencyRate:  parseFloat(String(row.currency_rate  ?? '1')),
    lines:         row.invoice_lines ? (row.invoice_lines as InvoiceLine[]) : undefined,
  };
}

function mapInvoiceToDb(inv: Omit<Invoice, 'id' | 'issueDate'>): Record<string, unknown> {
  return {
    lead_id:        inv.leadId        || null,
    customer_id:    inv.customerId    ?? null,
    customer_name:  inv.customerName,
    vehicle:        inv.vehicle,
    agreement_ref:  inv.agreementRef  || null,
    total_amount:   inv.totalAmount,
    vat_amount:     inv.vatAmount,
    net_amount:     inv.netAmount,
    payment_method: inv.paymentMethod || '',
    status:         inv.status,
    paid_date:      inv.paidDate      || null,
    vat_scheme:     inv.vatScheme     ?? 'normal',
    purchase_price: inv.purchasePrice || null,
    margin_amount:  inv.marginAmount  || null,
    currency_code:  inv.currencyCode  || 'SEK',
    currency_rate:  inv.currencyRate  || 1,
    ...(inv.lines ? { invoice_lines: inv.lines } : {}),
  };
}

// ── ID generator ───────────────────────────────────────────────────────────────

async function nextInvoiceId(_dealershipId: string): Promise<string> {
  const year = new Date().getFullYear();
  // Global max — invoices.id is a global PK, so omit dealership filter.
  const { data } = await db()
    .from('invoices')
    .select('id')
    .like('id', `INV-${year}-%`)
    .order('id', { ascending: false })
    .limit(1);
  const last = (data as any[])?.[0]?.id as string | undefined;
  const n = last ? parseInt(last.split('-').pop() ?? '0', 10) : 0;
  return `INV-${year}-${String(n + 1).padStart(3, '0')}`;
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getInvoices(): Promise<Invoice[]> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return [];
  try {
    const res = await fetch(`/api/invoices?dealershipId=${encodeURIComponent(dealershipId)}`);
    if (!res.ok) { console.error('[invoices] getInvoices API error:', res.status); return []; }
    const json = await res.json() as { invoices?: Record<string, unknown>[] };
    return (json.invoices ?? []).map(mapDbToInvoice);
  } catch (err) {
    console.error('[invoices] getInvoices fetch error:', err);
    return [];
  }
}

/** Fetch all invoices for a specific customer (by customer_id FK). */
export async function getInvoicesByCustomer(customerId: number): Promise<Invoice[]> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return [];
  try {
    const res = await fetch(`/api/invoices?dealershipId=${encodeURIComponent(dealershipId)}&customerId=${customerId}`);
    if (!res.ok) { console.error('[invoices] getInvoicesByCustomer API error:', res.status); return []; }
    const json = await res.json() as { invoices?: Record<string, unknown>[] };
    return (json.invoices ?? []).map(mapDbToInvoice);
  } catch (err) {
    console.error('[invoices] getInvoicesByCustomer fetch error:', err);
    return [];
  }
}

// ── Write ──────────────────────────────────────────────────────────────────────

export async function createInvoice(
  data: Omit<Invoice, 'id' | 'issueDate'>,
): Promise<Invoice> {
  const dealershipId = getDealershipId();
  if (!dealershipId) throw new Error('Not authenticated: no dealership context');

  // Deduplicate — don't create a second invoice with the same status for the same lead
  if (data.leadId) {
    const { data: existing } = await db()
      .from('invoices')
      .select('*')
      .eq('lead_id', data.leadId)
      .eq('dealership_id', dealershipId)
      .eq('status', data.status)
      .maybeSingle();
    if (existing) return mapDbToInvoice(existing as Record<string, unknown>);
  }

  const id = await nextInvoiceId(dealershipId);
  const row = {
    id,
    issue_date:    new Date().toISOString(),
    dealership_id: dealershipId,
    ...mapInvoiceToDb(data),
  };
  const { data: created, error } = await db()
    .from('invoices')
    .insert(row as any)
    .select()
    .single();
  if (error || !created) throw new Error(error?.message ?? 'createInvoice failed');
  return mapDbToInvoice(created as Record<string, unknown>);
}

export async function updateInvoicePaymentMethod(invoiceId: string, paymentMethod: string): Promise<void> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return;
  const { error } = await db()
    .from('invoices')
    .update({ payment_method: paymentMethod } as any)
    .eq('id', invoiceId)
    .eq('dealership_id', dealershipId);
  if (error) console.error('[invoices] updateInvoicePaymentMethod:', error.message);
}

export async function markInvoicePaid(leadId: string, paymentMethod: string): Promise<void> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return;
  const { error } = await db()
    .from('invoices')
    .update({ status: 'paid', paid_date: new Date().toISOString(), payment_method: paymentMethod } as any)
    .eq('lead_id', leadId)
    .eq('dealership_id', dealershipId)
    .eq('status', 'pending');
  if (error) console.error('[invoices] markInvoicePaid:', error.message);
}

/** Mark any invoice as paid directly by its ID (works for SRV-* service invoices too). */
export async function markInvoicePaidById(invoiceId: string, paymentMethod: string): Promise<void> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return;
  const { error } = await db()
    .from('invoices')
    .update({ status: 'paid', paid_date: new Date().toISOString(), payment_method: paymentMethod } as any)
    .eq('id', invoiceId)
    .eq('dealership_id', dealershipId);
  if (error) console.error('[invoices] markInvoicePaidById:', error.message);
}
