// ─── POST /api/counter-sale ───────────────────────────────────────────────────
// Creates a POS invoice directly — no lead required.
// Used by the counter-sale (butiksförsäljning) flow for walk-in accessory/gear sales.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

interface SaleItem {
  name:        string;
  quantity:    number;
  unit_cost:   number;
  total_cost:  number;
  part_number?: string;
}

async function nextPosId(dealershipId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await sb()
    .from('invoices')
    .select('id')
    .eq('dealership_id', dealershipId)
    .like('id', `POS-${year}-%`)
    .order('id', { ascending: false })
    .limit(1);
  const last = (data as { id: string }[] | null)?.[0]?.id;
  const n = last ? parseInt(last.split('-').pop() ?? '0', 10) : 0;
  return `POS-${year}-${String(n + 1).padStart(3, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealershipId:  string;
      customerName:  string;
      customerId?:   number | null;
      items:         SaleItem[];
      paymentMethod: string;
      totalAmount:   number;
      vatAmount:     number;
      netAmount:     number;
    };

    const { dealershipId, customerName, customerId, items, paymentMethod, totalAmount, vatAmount, netAmount } = body;
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: 'No items' }, { status: 400 });

    const id  = await nextPosId(dealershipId);
    const now = new Date().toISOString();

    const { data, error } = await sb()
      .from('invoices')
      .insert({
        id,
        dealership_id:  dealershipId,
        lead_id:        null,
        customer_id:    customerId ?? null,
        customer_name:  customerName || 'Gångkund',
        vehicle:        '',
        agreement_ref:  null,
        total_amount:   totalAmount,
        vat_amount:     vatAmount,
        net_amount:     netAmount,
        payment_method: paymentMethod,
        status:         'paid',
        issue_date:     now,
        paid_date:      now,
        parts:          items,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update customer lifetime_value if linked
    if (customerId && totalAmount > 0) {
      const { data: cust } = await sb()
        .from('customers')
        .select('lifetime_value')
        .eq('id', customerId)
        .eq('dealership_id', dealershipId)
        .single();
      const prev = parseFloat(String((cust as { lifetime_value?: string } | null)?.lifetime_value ?? '0')) || 0;
      await sb()
        .from('customers')
        .update({ lifetime_value: prev + totalAmount, last_activity: now, tag: 'Active' })
        .eq('id', customerId)
        .eq('dealership_id', dealershipId);
    }

    const totalStr = Math.round(totalAmount).toLocaleString('sv-SE');
    notify({
      dealershipId,
      type:    'payment',
      title:   `Butiksköp — ${id}`,
      message: `${customerName || 'Gångkund'} — ${totalStr} kr — ${paymentMethod}`,
      href:    '/invoices',
    });

    return NextResponse.json({ invoice: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
