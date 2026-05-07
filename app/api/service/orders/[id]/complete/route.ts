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

    // Fetch line items for the invoice parts column
    const [{ data: woParts }, { data: woTasks }] = await Promise.all([
      sb().from('work_order_parts').select('*').eq('work_order_id', Number(id)),
      sb().from('work_order_tasks').select('*').eq('work_order_id', Number(id)),
    ]);

    const invoiceLines = [
      ...(woTasks ?? []).map((tk: Record<string, unknown>) => {
        const hrs  = (tk.actual_hrs as number) > 0 ? (tk.actual_hrs as number) : (tk.estimated_hrs as number);
        const cost = hrs * (wo.labor_rate ?? 850);
        return { type: 'labour', name: tk.title as string, quantity: hrs, unit: 'tim', unit_cost: wo.labor_rate ?? 850, total_cost: cost };
      }),
      ...(woParts ?? []).map((p: Record<string, unknown>) => ({
        type: 'part', name: p.name as string, part_number: p.part_number as string,
        quantity: p.quantity as number, unit: 'st', unit_cost: p.unit_cost as number, total_cost: p.total_cost as number,
      })),
    ];

    const now = new Date().toISOString();

    // Compute net from actual line items — same formula as the Items tab
    const computedNet =
      (woTasks ?? []).reduce((s: number, tk: Record<string, unknown>) => {
        const hrs = (Number(tk.actual_hrs) > 0 ? Number(tk.actual_hrs) : Number(tk.estimated_hrs)) || 0;
        return s + hrs * (Number(wo.labor_rate) || 850);
      }, 0) +
      (woParts ?? []).reduce((s: number, p: Record<string, unknown>) => s + (Number(p.total_cost) || 0), 0);

    const netAmount   = Math.round(computedNet * 100) / 100;
    const vatAmount   = Math.round(netAmount * 0.25 * 100) / 100;         // 25% Swedish VAT on net
    const totalAmount = Math.round((netAmount + vatAmount) * 100) / 100;  // gross incl. VAT

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
        parts:          invoiceLines,
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

    // notify() is best-effort — never let it crash the route
    try {
      notify({
        dealershipId,
        type:    'payment',
        title:   'Serviceorder fakturerad',
        message: `AO-${id} · ${wo.customer_name} · ${totalAmount.toLocaleString('sv-SE')} kr`,
        href:    `/invoices`,
      });
    } catch { /* ignore */ }

    // Auto-update service reminder — best-effort (table may not exist yet)
    try {
      const todayDate = now.slice(0, 10);
      const matchQuery = sb()
        .from('service_reminders')
        .select('id, interval_months')
        .eq('dealership_id', dealershipId)
        .eq('status', 'active');
      const vehicleMatch = wo.vin
        ? matchQuery.eq('vin', wo.vin)
        : wo.plate
          ? matchQuery.ilike('plate', wo.plate)
          : null;

      if (vehicleMatch) {
        const { data: reminder } = await vehicleMatch.maybeSingle();
        if (reminder) {
          const nextDate = new Date(todayDate);
          nextDate.setMonth(nextDate.getMonth() + reminder.interval_months);
          await sb()
            .from('service_reminders')
            .update({
              last_service_at:  todayDate,
              next_reminder_at: nextDate.toISOString().slice(0, 10),
              updated_at:       now,
            })
            .eq('id', reminder.id);
        }
      }
    } catch { /* service_reminders table may not exist yet */ }

    return NextResponse.json({ invoiceId: invErr ? null : invoiceId, totalAmount });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
