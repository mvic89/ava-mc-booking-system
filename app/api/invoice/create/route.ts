// ─── POST /api/invoice/create ──────────────────────────────────────────────────
// Server-side invoice creation using the service-role client so RLS never blocks
// the INSERT.  Customer resolution (find-or-create) is also handled here so it
// too bypasses RLS — no browser anon-key calls needed for writes.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// ── Server-side customer resolution ────────────────────────────────────────────
// Finds the existing customer for a lead, or creates one.  Uses the service-role
// client so Supabase RLS on the customers table never blocks the INSERT.

async function resolveCustomer(
  leadId:       string,
  dealershipId: string,
): Promise<{ customerId: number | null; customerName: string }> {
  const { data: lead } = await sb()
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('dealership_id', dealershipId)
    .maybeSingle();
  if (!lead) return { customerId: null, customerName: '' };

  const fallbackName = String(lead.name ?? '');

  // Check for existing customer by personnummer, then email
  let existingId: number | null = null;
  if (lead.personnummer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r } = await sb().from('customers').select('id').eq('personnummer', lead.personnummer).eq('dealership_id', dealershipId).maybeSingle();
    if (r) existingId = (r as { id: number }).id;
  }
  if (!existingId && lead.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r } = await sb().from('customers').select('id').eq('email', lead.email).eq('dealership_id', dealershipId).maybeSingle();
    if (r) existingId = (r as { id: number }).id;
  }

  if (existingId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: c } = await sb().from('customers').select('first_name, last_name').eq('id', existingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = c ? `${(c as any).first_name} ${(c as any).last_name}`.trim() : fallbackName;
    return { customerId: existingId, customerName: name };
  }

  // Create new customer row
  const nameParts = fallbackName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName  = nameParts.slice(1).join(' ') || '—';
  const { data: newCust, error: insertErr } = await sb()
    .from('customers')
    .insert({
      first_name:         firstName,
      last_name:          lastName,
      personnummer:       lead.personnummer || null,
      email:              lead.email        || null,
      phone:              lead.phone        || null,
      address:            lead.address      || null,
      source:             lead.source === 'BankID' ? 'BankID' : 'Manual',
      bankid_verified:    lead.source === 'BankID',
      protected_identity: false,
      gender:             'Man',
      tag:                'New',
      lifetime_value:     lead.value        || 0,
      last_activity:      new Date().toISOString(),
      dealership_id:      dealershipId,
    })
    .select('id')
    .single();

  if (!insertErr && newCust) {
    return { customerId: (newCust as { id: number }).id, customerName: `${firstName} ${lastName}`.trim() };
  }

  // Race-condition duplicate key — look up the row that beat us
  if (insertErr?.code === '23505') {
    if (lead.personnummer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: r } = await sb().from('customers').select('id, first_name, last_name').eq('personnummer', lead.personnummer).eq('dealership_id', dealershipId).maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (r) return { customerId: (r as any).id, customerName: `${(r as any).first_name} ${(r as any).last_name}`.trim() };
    }
    if (lead.email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: r } = await sb().from('customers').select('id, first_name, last_name').eq('email', lead.email).eq('dealership_id', dealershipId).maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (r) return { customerId: (r as any).id, customerName: `${(r as any).first_name} ${(r as any).last_name}`.trim() };
    }
  }

  console.error('[invoice/create] resolveCustomer insert failed:', insertErr?.code, insertErr?.message);
  return { customerId: null, customerName: fallbackName };
}

// ── Sequential invoice ID generator ────────────────────────────────────────────

async function nextInvoiceId(_dealershipId: string): Promise<string> {
  const year = new Date().getFullYear();
  // Query the GLOBAL max — invoices.id is a global PK so any two dealerships
  // sharing the same ID would cause a 23505.  Removing the dealership filter
  // ensures we always increment past every existing row, not just our own.
  const { data } = await sb()
    .from('invoices')
    .select('id')
    .like('id', `INV-${year}-%`)
    .order('id', { ascending: false })
    .limit(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const last = (data as any[])?.[0]?.id as string | undefined;
  const n = last ? parseInt(last.split('-').pop() ?? '0', 10) : 0;
  return `INV-${year}-${String(n + 1).padStart(3, '0')}`;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      dealershipId:  string;
      leadId?:       string;
      customerId?:   number | null;
      customerName:  string;
      vehicle:       string;
      agreementRef?: string;
      totalAmount:   number;
      paymentMethod: string;
      status:        'pending' | 'paid';
      paidDate?:     string;
    };

    const { dealershipId, leadId, customerId: bodyCustomerId, customerName: bodyCustomerName,
            vehicle, agreementRef, totalAmount, paymentMethod, status, paidDate } = body;

    if (!dealershipId) {
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
    }

    const vatAmount = Math.round(totalAmount - totalAmount / 1.25);
    const netAmount = totalAmount - vatAmount;

    // Resolve customer server-side (service-role bypasses RLS) when not already known
    let customerId    = bodyCustomerId ?? null;
    let customerName  = bodyCustomerName;
    if (leadId && customerId == null) {
      const resolved = await resolveCustomer(leadId, dealershipId);
      if (resolved.customerId != null)  customerId   = resolved.customerId;
      if (resolved.customerName)        customerName = resolved.customerName;
    }

    // If this is a confirmed payment, mark any pending invoice for this lead as paid first
    if (status === 'paid' && leadId) {
      await sb()
        .from('invoices')
        .update({ status: 'paid', paid_date: paidDate ?? new Date().toISOString(), payment_method: paymentMethod })
        .eq('lead_id', leadId)
        .eq('dealership_id', dealershipId)
        .eq('status', 'pending');

      // Close the lead and link it to the customer (service-role — no RLS issue)
      await sb()
        .from('leads')
        .update({ stage: 'closed', customer_id: customerId, closed_at: paidDate ?? new Date().toISOString() })
        .eq('id', leadId)
        .eq('dealership_id', dealershipId);
    }

    // Deduplicate — return the existing invoice if one already exists for this lead+status
    if (leadId) {
      const { data: existing } = await sb()
        .from('invoices')
        .select('id')
        .eq('lead_id', leadId)
        .eq('dealership_id', dealershipId)
        .eq('status', status)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (existing) return NextResponse.json({ ok: true, invoiceId: (existing as any).id, customerId });
    }

    // Retry loop — handles concurrent cross-lead ID collisions (23505 on invoices_pkey)
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = await nextInvoiceId(dealershipId);
      const { data: created, error } = await sb()
        .from('invoices')
        .insert({
          id,
          issue_date:     new Date().toISOString(),
          dealership_id:  dealershipId,
          lead_id:        leadId        || null,
          customer_id:    customerId    ?? null,
          customer_name:  customerName,
          vehicle,
          agreement_ref:  agreementRef  || null,
          total_amount:   totalAmount,
          vat_amount:     vatAmount,
          net_amount:     netAmount,
          payment_method: paymentMethod || '',
          status,
          paid_date:      paidDate      || null,
        })
        .select('id')
        .single();

      if (!error) {
        return NextResponse.json({ ok: true, invoiceId: (created as { id: string }).id, customerId });
      }

      if (error.code === '23505') {
        // Same-lead race: another concurrent request for this lead already inserted
        if (leadId) {
          const { data: rows } = await sb()
            .from('invoices')
            .select('id')
            .eq('lead_id', leadId)
            .eq('dealership_id', dealershipId)
            .order('issue_date', { ascending: false })
            .limit(1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const found = (rows as any[])?.[0];
          if (found) return NextResponse.json({ ok: true, invoiceId: (found as { id: string }).id, customerId });
        }
        // Cross-lead race: regenerate ID and retry
        console.warn(`[invoice/create] ID collision attempt ${attempt + 1}, retrying…`);
        continue;
      }

      console.error('[invoice/create] insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error('[invoice/create] too many ID collisions for lead', leadId);
    return NextResponse.json({ error: 'Could not generate a unique invoice ID' }, { status: 500 });

  } catch (err) {
    console.error('[invoice/create] unexpected error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
