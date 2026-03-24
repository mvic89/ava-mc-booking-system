// ─── POST /api/invoice/create ──────────────────────────────────────────────────
// Server-side invoice creation using the service-role client so RLS never blocks
// the INSERT.  Customer creation is handled separately (client-side) and the
// resulting customerId is passed in the request body.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// ── Sequential invoice ID generator ────────────────────────────────────────────

async function nextInvoiceId(dealershipId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await sb()
    .from('invoices')
    .select('id')
    .eq('dealership_id', dealershipId)
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

    const { dealershipId, leadId, customerId, customerName, vehicle, agreementRef,
            totalAmount, paymentMethod, status, paidDate } = body;

    if (!dealershipId) {
      return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
    }

    const vatAmount = Math.round(totalAmount - totalAmount / 1.25);
    const netAmount = totalAmount - vatAmount;

    // If this is a confirmed payment, mark any pending invoice for this lead as paid first
    if (status === 'paid' && leadId) {
      await sb()
        .from('invoices')
        .update({ status: 'paid', paid_date: paidDate ?? new Date().toISOString(), payment_method: paymentMethod })
        .eq('lead_id', leadId)
        .eq('dealership_id', dealershipId)
        .eq('status', 'pending');
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
      if (existing) return NextResponse.json({ ok: true, invoiceId: (existing as any).id });
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
        return NextResponse.json({ ok: true, invoiceId: (created as { id: string }).id });
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
          if (found) return NextResponse.json({ ok: true, invoiceId: (found as { id: string }).id });
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
