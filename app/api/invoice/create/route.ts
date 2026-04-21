// ─── POST /api/invoice/create ──────────────────────────────────────────────────
// Server-side invoice creation using the service-role client so RLS never blocks
// the INSERT.  Customer resolution (find-or-create) is also handled here so it
// too bypasses RLS — no browser anon-key calls needed for writes.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// ── Personnummer utilities ─────────────────────────────────────────────────────
function genderFromPnr(pnr: string | null | undefined): 'Man' | 'Kvinna' {
  if (!pnr) return 'Man';
  const d = pnr.replace(/\D/g, '');
  const idx = d.length === 12 ? 10 : 8;
  const digit = parseInt(d[idx] ?? '1', 10);
  return digit % 2 !== 0 ? 'Man' : 'Kvinna';
}
function birthDateFromPnr(pnr: string | null | undefined): string | null {
  if (!pnr) return null;
  const d = pnr.replace(/\D/g, '');
  if (d.length === 12) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  if (d.length >= 10) {
    const yy = parseInt(d.slice(0, 2), 10);
    const century = yy > (new Date().getFullYear() % 100) ? 1900 : 2000;
    return `${century + yy}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
  }
  return null;
}

// ── Server-side customer resolution ────────────────────────────────────────────
// Finds the existing customer for a lead, or creates one.  Uses the service-role
// client so Supabase RLS on the customers table never blocks the INSERT.
// totalAmount is the actual invoice amount (used as lifetime_value).

async function resolveCustomer(
  leadId:       string,
  dealershipId: string,
  totalAmount:  number,
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
    // Update lifetime_value and last_activity for existing customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: c } = await sb().from('customers').select('first_name, last_name, lifetime_value').eq('id', existingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = c ? `${(c as any).first_name} ${(c as any).last_name}`.trim() : fallbackName;
    if (totalAmount > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prev = parseFloat(String((c as any)?.lifetime_value ?? '0')) || 0;
      await sb().from('customers').update({
        lifetime_value: prev + totalAmount,
        last_activity:  new Date().toISOString(),
        tag:            'Active',
      }).eq('id', existingId).eq('dealership_id', dealershipId);
    }
    return { customerId: existingId, customerName: name };
  }

  // Create new customer row using actual sale amount as lifetime_value
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
      postal_code:        lead.postal_code  || null,
      city:               lead.city         || null,
      birth_date:         birthDateFromPnr(lead.personnummer as string),
      gender:             genderFromPnr(lead.personnummer as string),
      source:             lead.source === 'BankID' ? 'BankID' : 'Manual',
      bankid_verified:    lead.source === 'BankID',
      protected_identity: false,
      tag:                'Active',
      lifetime_value:     totalAmount > 0 ? totalAmount : (parseFloat(String(lead.value ?? '0')) || 0),
      last_activity:      new Date().toISOString(),
      customer_since:     new Date().toISOString(),
      risk_level:         'low',
      citizenship:        null,
      deceased:           false,
      notes:              null,
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

// ── Inventory deduction after a confirmed sale ─────────────────────────────────
// Decrements stock for the motorcycle and any accessories/spare-parts in the offer.
// Safe to call multiple times — stock never goes below 0.

async function deductInventory(leadId: string, dealershipId: string): Promise<void> {
  // Fetch the latest offer for this lead to get vehicle + accessories
  const { data: offer } = await sb()
    .from('offers')
    .select('vehicle, vin, accessories')
    .eq('lead_id', leadId)
    .eq('dealership_id', dealershipId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!offer) {
    // No offer found — may be an accessories-only order; fall back to lead_items
    const { data: lead } = await sb()
      .from('leads')
      .select('lead_items')
      .eq('id', leadId)
      .eq('dealership_id', dealershipId)
      .maybeSingle();
    if (!lead?.lead_items) return;
    try {
      const items = JSON.parse(lead.lead_items) as { id: string; qty: number }[];
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (!item.id || !item.qty) continue;
        const table = item.id.startsWith('SP-') ? 'spare_parts' : 'accessories';
        const { data: inv } = await sb().from(table).select('id, stock').eq('id', item.id).eq('dealership_id', dealershipId).maybeSingle();
        if (inv && inv.stock > 0) {
          await sb().from(table).update({ stock: Math.max(0, inv.stock - item.qty) }).eq('id', item.id).eq('dealership_id', dealershipId);
          console.log(`[invoice/create] decremented ${table} stock for ${item.id} by ${item.qty} (lead_items fallback)`);
        }
      }
    } catch {
      // lead_items not valid JSON — skip silently
    }
    return;
  }

  // Decrement motorcycle stock — look up by VIN first, then by name
  const { vehicle, vin, accessories: accessoriesJson } = offer as {
    vehicle: string; vin: string; accessories: string;
  };

  if (vin) {
    const { data: mc } = await sb().from('motorcycles').select('id, stock').eq('vin', vin).eq('dealership_id', dealershipId).maybeSingle();
    if (mc && mc.stock > 0) {
      await sb().from('motorcycles').update({ stock: Math.max(0, mc.stock - 1) }).eq('id', mc.id).eq('dealership_id', dealershipId);
      console.log('[invoice/create] decremented motorcycle stock for VIN:', vin);
    }
  } else if (vehicle) {
    const { data: mc } = await sb().from('motorcycles').select('id, stock').ilike('name', `%${vehicle}%`).eq('dealership_id', dealershipId).limit(1).maybeSingle();
    if (mc && mc.stock > 0) {
      await sb().from('motorcycles').update({ stock: Math.max(0, mc.stock - 1) }).eq('id', mc.id).eq('dealership_id', dealershipId);
      console.log('[invoice/create] decremented motorcycle stock for vehicle:', vehicle);
    }
  }

  // Decrement accessories / spare parts stock
  if (accessoriesJson) {
    try {
      const items = JSON.parse(accessoriesJson) as { id: string; qty: number }[];
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (!item.id || !item.qty) continue;
        const table = item.id.startsWith('SP-') ? 'spare_parts' : 'accessories';
        const { data: inv } = await sb().from(table).select('id, stock').eq('id', item.id).eq('dealership_id', dealershipId).maybeSingle();
        if (inv && inv.stock > 0) {
          await sb().from(table).update({ stock: Math.max(0, inv.stock - item.qty) }).eq('id', item.id).eq('dealership_id', dealershipId);
          console.log(`[invoice/create] decremented ${table} stock for ${item.id} by ${item.qty}`);
        }
      }
    } catch {
      // accessories field may not be JSON — skip silently
    }
  }
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
      const resolved = await resolveCustomer(leadId, dealershipId, totalAmount);
      if (resolved.customerId != null)  customerId   = resolved.customerId;
      if (resolved.customerName)        customerName = resolved.customerName;
    }

    // If this is a confirmed payment, mark any pending invoice for this lead as paid first
    if (status === 'paid' && leadId) {
      const { data: transitioned } = await sb()
        .from('invoices')
        .update({ status: 'paid', paid_date: paidDate ?? new Date().toISOString(), payment_method: paymentMethod })
        .eq('lead_id', leadId)
        .eq('dealership_id', dealershipId)
        .eq('status', 'pending')
        .select('id');

      // If a pending invoice just transitioned to paid, deduct inventory now.
      // We do this HERE because the deduplication check below will short-circuit
      // and return before reaching the normal deductInventory call further down.
      if (transitioned && (transitioned as { id: string }[]).length > 0) {
        deductInventory(leadId, dealershipId).catch((err) =>
          console.warn('[invoice/create] deductInventory (pending→paid) failed (non-fatal):', err),
        );
      }

      // Close the lead and link it to the customer (service-role — no RLS issue)
      await sb()
        .from('leads')
        .update({ stage: 'closed', customer_id: customerId, closed_at: paidDate ?? new Date().toISOString() })
        .eq('id', leadId)
        .eq('dealership_id', dealershipId);
    }

    // Move lead to pending_payment column when a pending invoice is first created
    if (status === 'pending' && leadId) {
      await sb()
        .from('leads')
        .update({ stage: 'pending_payment' })
        .eq('id', leadId)
        .eq('dealership_id', dealershipId)
        .in('stage', ['new', 'contacted', 'testride', 'negotiating']);
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
        const invoiceId = (created as { id: string }).id;
        logAudit({
          action:       status === 'paid' ? 'INVOICE_PAID' : 'INVOICE_CREATED',
          entity:       'invoice',
          entityId:     invoiceId,
          details:      { customer_name: customerName, vehicle, total_amount: totalAmount, payment_method: paymentMethod, status },
          dealershipId: dealershipId,
        });
        // Write a payments row for every transaction (pending or paid)
        sb().from('payments').insert({
          invoice_id:   invoiceId,
          lead_id:      leadId     ? Number(leadId) : null,
          customer_id:  customerId ?? null,
          amount:       totalAmount,
          currency:     'SEK',
          method:       paymentMethod || 'unknown',
          status:       status === 'paid' ? 'confirmed' : 'pending',
          provider:     paymentMethod || null,
          confirmed_at: status === 'paid' ? (paidDate ?? new Date().toISOString()) : null,
        }).then(() => {});
        // Notification
        const amountStr = Math.round(totalAmount).toLocaleString('sv-SE');
        if (status === 'paid') {
          notify({
            dealershipId,
            type:    'payment',
            title:   'Betalning mottagen',
            message: `${customerName} — ${vehicle} — ${amountStr} kr`,
            href:    leadId ? `/sales/leads/${leadId}/payment` : '/invoices',
          });
        } else {
          notify({
            dealershipId,
            type:    'payment',
            title:   'Faktura skapad',
            message: `${invoiceId} — ${customerName} — ${amountStr} kr (väntande)`,
            href:    '/invoices',
          });
        }

        // Fire-and-forget Fortnox auto-sync for paid invoices — never blocks the response
        if (status === 'paid') {
          import('@/lib/fortnox/sync')
            .then(({ syncInvoicesToFortnox }) => syncInvoicesToFortnox(dealershipId, [invoiceId]))
            .catch(() => { /* non-fatal — dealer can retry from /accounting */ });
          // Decrement inventory stock for the sold motorcycle + accessories (fire-and-forget)
          if (leadId) {
            deductInventory(leadId, dealershipId).catch((err) =>
              console.warn('[invoice/create] deductInventory failed (non-fatal):', err),
            );
          }
        }
        return NextResponse.json({ ok: true, invoiceId, customerId });
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
