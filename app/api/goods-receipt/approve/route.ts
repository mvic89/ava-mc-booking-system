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
        // Skip backorder-only rows (nothing was physically received yet)
        if (!item.inventory_id || !item.matched || item.received_qty === 0) continue

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

    // ── Check if PO is now fully received ─────────────────────────────────────
    // We compute fulfilment dynamically from goods_receipt_items so we don't
    // need extra columns on po_line_items (received_qty / backorder_qty).
    if (receipt.po_id) {
        // What was ordered on this PO (per article number)
        const { data: poLineItems } = await db
            .from('po_line_items')
            .select('article_number, order_qty')
            .eq('po_id', receipt.po_id)

        // All approved receipts linked to this PO (including the one we just approved)
        const { data: approvedReceipts } = await db
            .from('goods_receipts')
            .select('id')
            .eq('dealership_id', dealership_id)
            .eq('po_id', receipt.po_id)
            .eq('status', 'approved')     // note: this receipt is still pending at this point…

        // …so also include the current receipt_id we are about to approve
        const approvedIds = [
            ...(approvedReceipts?.map((r: { id: string }) => r.id) ?? []),
            receipt_id,
        ]

        const { data: receivedItems } = await db
            .from('goods_receipt_items')
            .select('article_number, received_qty')
            .in('receipt_id', approvedIds)

        // Sum received_qty per article number
        const receivedByArticle = new Map<string, number>()
        for (const ri of receivedItems ?? []) {
            const key = (ri.article_number ?? '').trim().toUpperCase()
            receivedByArticle.set(key, (receivedByArticle.get(key) ?? 0) + ri.received_qty)
        }

        // PO is fully received when every ordered line has been fully delivered
        const allFulfilled = (poLineItems ?? []).length > 0 && (poLineItems ?? []).every(
            (pl: { article_number: string; order_qty: number }) => {
                const key = (pl.article_number ?? '').trim().toUpperCase()
                return (receivedByArticle.get(key) ?? 0) >= pl.order_qty
            }
        )

        await db.from('purchase_orders')
            .update({ status: allFulfilled ? 'Received' : 'Partial' })
            .eq('id', receipt.po_id)
            .eq('dealership_id', dealership_id)
            .in('status', ['Sent', 'Partial'])   // never downgrade an already-Received PO
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
