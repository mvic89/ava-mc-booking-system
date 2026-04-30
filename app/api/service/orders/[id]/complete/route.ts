import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// POST /api/service/orders/[id]/complete — mark completed + create service invoice
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dealershipId } = body;
    if (!dealershipId) return NextResponse.json({ error: 'dealershipId required' }, { status: 400 });

    // Fetch the work order
    const { data: wo, error: woErr } = await sb()
      .from('work_orders')
      .select('*')
      .eq('id', Number(id))
      .eq('dealership_id', dealershipId)
      .single();

    if (woErr || !wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const now = new Date().toISOString();
    const totalAmount = wo.total_cost ?? 0;
    const vatAmount   = Math.round(totalAmount * 0.2 * 100) / 100;  // 20% VAT
    const netAmount   = Math.round((totalAmount - vatAmount) * 100) / 100;

    // Generate service invoice ID
    const year   = new Date().getFullYear();
    const { count } = await sb()
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('dealership_id', dealershipId)
      .like('id', `SRV-${year}-%`);
    const seq      = String((count ?? 0) + 1).padStart(3, '0');
    const invoiceId = `SRV-${year}-${seq}`;

    // Create invoice
    const { error: invErr } = await sb()
      .from('invoices')
      .insert({
        id:             invoiceId,
        dealership_id:  dealershipId,
        customer_id:    wo.customer_id ?? null,
        customer_name:  wo.customer_name,
        vehicle:        wo.vehicle_name,
        total_amount:   totalAmount,
        vat_amount:     vatAmount,
        net_amount:     netAmount,
        payment_method: 'invoice',
        status:         'pending',
        issue_date:     now,
        notes:          `Servicearbete AO-${id}`,
      });

    if (invErr) {
      console.error('[service/complete] invoice error:', invErr.message);
    }

    // Update work order to completed + invoiced
    await sb()
      .from('work_orders')
      .update({
        status:       invErr ? 'completed' : 'invoiced',
        invoice_id:   invErr ? null : invoiceId,
        completed_at: now,
        updated_at:   now,
      })
      .eq('id', Number(id))
      .eq('dealership_id', dealershipId);

    // Update customer lifetime value
    if (wo.customer_id && totalAmount > 0) {
      const { data: cust } = await sb()
        .from('customers')
        .select('lifetime_value')
        .eq('id', wo.customer_id)
        .single();
      if (cust) {
        await sb()
          .from('customers')
          .update({
            lifetime_value: (cust.lifetime_value ?? 0) + totalAmount,
            last_activity:  now,
            updated_at:     now,
          })
          .eq('id', wo.customer_id);
      }
    }

    notify({
      dealershipId,
      type:    'payment',
      title:   'Serviceorder fakturerad',
      message: `AO-${id} · ${wo.customer_name} · ${totalAmount.toLocaleString('sv-SE')} kr`,
      href:    `/invoices`,
    });

    return NextResponse.json({ invoiceId: invErr ? null : invoiceId, totalAmount });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
