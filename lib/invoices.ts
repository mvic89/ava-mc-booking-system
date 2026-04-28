// ─── Invoice store — Supabase backing store ───────────────────────────────────
import { getSupabaseBrowser } from './supabase';
import { getDealershipId } from './tenant';

export interface Invoice {
  id:            string;   // INV-YYYY-NNN
  leadId:        string;   // URL param id of the originating lead
  customerId?:   number;   // FK → customers.id  (set when lead converts to customer)
  customerName:  string;
  vehicle:       string;
  agreementRef:  string;   // AGR-YYYY-NNNN
  totalAmount:   number;   // kr incl. 25% VAT
  vatAmount:     number;   // kr
  netAmount:     number;   // kr excl. VAT
  paymentMethod: string;
  status:        'paid' | 'pending';
  issueDate:     string;   // ISO
  paidDate?:     string;   // ISO
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
  };
}

function mapInvoiceToDb(inv: Omit<Invoice, 'id' | 'issueDate'>): Record<string, unknown> {
  return {
    lead_id:        inv.leadId       || null,
    customer_id:    inv.customerId   ?? null,
    customer_name:  inv.customerName,
    vehicle:        inv.vehicle,
    agreement_ref:  inv.agreementRef || null,
    total_amount:   inv.totalAmount,
    vat_amount:     inv.vatAmount,
    net_amount:     inv.netAmount,
    payment_method: inv.paymentMethod || '',
    status:         inv.status,
    paid_date:      inv.paidDate     || null,
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
  // Use the server-side route so the service-role key bypasses RLS on the invoices table.
  try {
    const res = await fetch(`/api/invoice/list?dealershipId=${encodeURIComponent(dealershipId)}`);
    if (!res.ok) {
      console.error('[invoices] getInvoices HTTP', res.status);
      return [];
    }
    const json = await res.json() as { invoices?: unknown[] };
    return (json.invoices ?? []).map((r) => mapDbToInvoice(r as Record<string, unknown>));
  } catch (err) {
    console.error('[invoices] getInvoices:', err);
    return [];
  }
}

/** Fetch all invoices for a specific customer (by customer_id FK). */
export async function getInvoicesByCustomer(customerId: number): Promise<Invoice[]> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return [];
  const { data, error } = await db()
    .from('invoices')
    .select('*')
    .eq('customer_id', customerId)
    .eq('dealership_id', dealershipId)
    .order('issue_date', { ascending: false });
  if (error) { console.error('[invoices] getInvoicesByCustomer:', error.message); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => mapDbToInvoice(r));
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
