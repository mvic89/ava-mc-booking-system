import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const db = getSupabaseAdmin()

    let body: { receipt_id: string; action: 'approve' | 'reject'; dealership_id: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { receipt_id, action, dealership_id } = body
    if (!receipt_id || !action || !dealership_id) {
        return NextResponse.json({ error: 'receipt_id, action, and dealership_id are required' }, { status: 400 })
    }

    // ── Fetch receipt + items ──────────────────────────────────────────────────
    const { data: receipt } = await db
        .from('goods_receipts')
        .select('*, items:goods_receipt_items(*)')
        .eq('id', receipt_id)
        .eq('dealership_id', dealership_id)
        .single()

    if (!receipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }
    if (receipt.status !== 'pending_approval') {
        return NextResponse.json({ error: `Receipt is already ${receipt.status}` }, { status: 409 })
    }

    // ── Reject: just mark as rejected ─────────────────────────────────────────
    if (action === 'reject') {
        await db.from('goods_receipts')
            .update({ status: 'rejected' })
            .eq('id', receipt_id)

        return NextResponse.json({ ok: true, status: 'rejected' })
    }

    // ── Approve: update stock + PO line items + PO status ─────────────────────
    const items = (receipt.items ?? []) as {
        inventory_id:   string | null
        received_qty:   number
        ordered_qty:    number | null
        backorder_qty:  number
        article_number: string | null
        name:           string
        matched:        boolean
    }[]

    let stockUpdated = 0

    for (const item of items) {
        if (!item.inventory_id || !item.matched) continue

        const table = item.inventory_id.startsWith('MC-') ? 'motorcycles'
                    : item.inventory_id.startsWith('SP-') ? 'spare_parts'
                    : 'accessories'

        const { data: current } = await db
            .from(table)
            .select('stock')
            .eq('id', item.inventory_id)
            .eq('dealership_id', dealership_id)
            .single()

        if (current) {
            await db.from(table)
                .update({ stock: (current.stock ?? 0) + item.received_qty })
                .eq('id', item.inventory_id)
                .eq('dealership_id', dealership_id)
            stockUpdated++
        }
    }

    // ── Update PO line items with received + backorder qty ────────────────────
    if (receipt.po_id) {
        const { data: poItems } = await db
            .from('po_line_items')
            .select('*')
            .eq('po_id', receipt.po_id)

        for (const item of items) {
            if (!item.inventory_id) continue
            const poItem = poItems?.find(
                (p: { inventory_id: string }) => p.inventory_id === item.inventory_id
            )
            if (!poItem) continue

            const newReceived  = (poItem.received_qty  ?? 0) + item.received_qty
            const newBackorder = Math.max(0, (poItem.order_qty ?? poItem.orderQty ?? 0) - newReceived)

            await db.from('po_line_items')
                .update({ received_qty: newReceived, backorder_qty: newBackorder })
                .eq('id', poItem.id)
        }

        // Mark PO as Received if all items have no backorder
        const { data: updatedPoItems } = await db
            .from('po_line_items')
            .select('backorder_qty')
            .eq('po_id', receipt.po_id)

        const fullyReceived = updatedPoItems?.every(
            (p: { backorder_qty: number }) => (p.backorder_qty ?? 0) === 0
        )

        if (fullyReceived) {
            await db.from('purchase_orders')
                .update({ status: 'Received' })
                .eq('id', receipt.po_id)
                .eq('dealership_id', dealership_id)
        }
    }

    // ── Mark receipt as approved ───────────────────────────────────────────────
    await db.from('goods_receipts')
        .update({ status: 'approved' })
        .eq('id', receipt_id)

    return NextResponse.json({
        ok:            true,
        status:        'approved',
        stock_updated: stockUpdated,
        po_id:         receipt.po_id ?? null,
    })
}
