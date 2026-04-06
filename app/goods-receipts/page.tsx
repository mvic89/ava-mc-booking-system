'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { getDealershipId, getDealershipTag } from '@/lib/tenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptItem {
    id: number
    inventory_id:   string | null
    article_number: string | null
    name:           string
    ordered_qty:    number | null
    received_qty:   number
    backorder_qty:  number
    unit_cost:      number | null
    matched:        boolean
}

interface GoodsReceipt {
    id:                   string
    po_id:                string | null
    vendor:               string
    delivery_note_number: string | null
    received_date:        string
    received_by:          string | null
    notes:                string | null
    source:               string
    status:               'pending_approval' | 'approved' | 'rejected'
    pdf_url:              string | null
    created_at:           string
    items?:               ReceiptItem[]
}

// ── Manual entry form state ───────────────────────────────────────────────────

const EMPTY_ITEM = { article_number: '', name: '', ordered_qty: '', received_qty: '', unit_cost: '' }
const EMPTY_FORM = {
    vendor:               '',
    po_id:                '',
    delivery_note_number: '',
    received_date:        new Date().toISOString().split('T')[0],
    received_by:          '',
    notes:                '',
    items:                [{ ...EMPTY_ITEM }],
}

// ── Generate GR ID client-side ────────────────────────────────────────────────

function makeGrId(tag: string, count: number) {
    return `GR-${tag.toUpperCase()}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
    return source === 'email_automation'
        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">⚡ Auto</span>
        : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">✏️ Manual</span>
}

function StatusBadge({ status }: { status: GoodsReceipt['status'] }) {
    if (status === 'approved')
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Approved</span>
    if (status === 'rejected')
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">✕ Rejected</span>
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ Pending Approval</span>
}

function DetailModal({ receipt, onClose, onStatusChange, onPoRelinked }: {
    receipt: GoodsReceipt
    onClose: () => void
    onStatusChange: (id: string, status: GoodsReceipt['status']) => void
    onPoRelinked:   (id: string, newPoId: string) => void
}) {
    const [acting,       setActing]       = useState<'approve' | 'reject' | null>(null)
    const [poStatus,     setPoStatus]     = useState<string | null>(null)
    const [openPos,      setOpenPos]      = useState<{ id: string; vendor: string; status: string }[]>([])
    const [showRelink,   setShowRelink]   = useState(false)
    const [relinking,    setRelinking]    = useState(false)
    const [selectedNewPo, setSelectedNewPo] = useState('')

    const totalReceived = receipt.items?.reduce((s, i) => s + i.received_qty, 0) ?? 0
    const matched       = receipt.items?.filter(i => i.matched).length ?? 0
    const hasBackorder  = receipt.items?.some(i => (i.backorder_qty ?? 0) > 0) ?? false

    // Check if the linked PO is still open
    useEffect(() => {
        if (!receipt.po_id) return
        supabase
            .from('purchase_orders')
            .select('status')
            .eq('id', receipt.po_id)
            .maybeSingle()
            .then(({ data }) => setPoStatus(data?.status ?? null))
    }, [receipt.po_id])

    const poIsClosed = !!receipt.po_id && poStatus !== null && !['Sent', 'Partial', 'Approved', 'Draft'].includes(poStatus)

    async function loadOpenPos() {
        const dealershipId = getDealershipId()
        const { data } = await supabase
            .from('purchase_orders')
            .select('id, vendor, status')
            .eq('dealership_id', dealershipId)
            .in('status', ['Sent', 'Partial', 'Approved'])
            .ilike('vendor', `%${receipt.vendor}%`)
            .order('date', { ascending: false })
            .limit(20)
        setOpenPos(data ?? [])
        setShowRelink(true)
    }

    async function handleRelink() {
        if (!selectedNewPo) return
        setRelinking(true)
        const { error } = await supabase
            .from('goods_receipts')
            .update({ po_id: selectedNewPo })
            .eq('id', receipt.id)
        if (!error) {
            onPoRelinked(receipt.id, selectedNewPo)
            setShowRelink(false)
            setPoStatus(null) // re-check on next render
        }
        setRelinking(false)
    }

    async function handleAction(action: 'approve' | 'reject') {
        setActing(action)
        try {
            const res = await fetch('/api/goods-receipt/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receipt_id:    receipt.id,
                    action,
                    dealership_id: getDealershipId(),
                }),
            })
            if (res.ok) {
                onStatusChange(receipt.id, action === 'approve' ? 'approved' : 'rejected')
                onClose()
            } else {
                const err = await res.json().catch(() => ({}))
                console.error('[approve]', err)
            }
        } finally {
            setActing(null)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                            Goods Receipt · <span className="font-mono">{receipt.id}</span>
                        </p>
                        <h2 className="text-lg font-bold text-gray-900">{receipt.vendor}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <SourceBadge source={receipt.source} />
                            <StatusBadge status={receipt.status} />
                            {receipt.po_id && (
                                <span className="text-[10px] font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                    {receipt.po_id}
                                </span>
                            )}
                            {hasBackorder && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                    📋 PO Incomplete — awaiting backorder
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 text-sm font-bold shrink-0"
                    >✕</button>
                </div>

                {/* Pending approval banner */}
                {receipt.status === 'pending_approval' && (
                    <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 shrink-0">
                        <span className="text-xl">⏳</span>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-amber-800">Awaiting Admin Approval</p>
                            <p className="text-xs text-amber-600 mt-0.5">Stock will not update until you approve this delivery.</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={() => handleAction('reject')}
                                disabled={!!acting}
                                className="px-3 py-1.5 bg-white border border-red-300 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {acting === 'reject' ? '…' : 'Reject'}
                            </button>
                            <button
                                onClick={() => handleAction('approve')}
                                disabled={!!acting}
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {acting === 'approve' ? '…' : 'Approve & Update Stock'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Closed PO warning */}
                {poIsClosed && !showRelink && (
                    <div className="mx-6 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 shrink-0">
                        <span className="text-xl">⚠️</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-red-800">PO already fully received</p>
                            <p className="text-xs text-red-600 mt-0.5">
                                <span className="font-mono">{receipt.po_id}</span> is closed. Would you like to link this delivery to a different open PO?
                            </p>
                        </div>
                        <button
                            onClick={loadOpenPos}
                            className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            Re-link to PO
                        </button>
                    </div>
                )}

                {/* Re-link PO picker */}
                {showRelink && (
                    <div className="mx-6 mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 shrink-0">
                        <p className="text-xs font-bold text-blue-800 mb-2">Select an open PO to link this delivery to:</p>
                        {openPos.length === 0 ? (
                            <p className="text-xs text-blue-600">No open POs found for {receipt.vendor}.</p>
                        ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto mb-3">
                                {openPos.map(po => (
                                    <label key={po.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 rounded-lg px-2 py-1.5">
                                        <input
                                            type="radio"
                                            name="relink-po"
                                            value={po.id}
                                            checked={selectedNewPo === po.id}
                                            onChange={e => setSelectedNewPo(e.target.value)}
                                            className="accent-blue-600"
                                        />
                                        <span className="font-mono text-xs text-blue-900 font-semibold">{po.id}</span>
                                        <span className="text-xs text-blue-600 truncate">{po.vendor}</span>
                                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-800">{po.status}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowRelink(false); setSelectedNewPo('') }}
                                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRelink}
                                disabled={!selectedNewPo || relinking}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {relinking ? 'Linking…' : 'Confirm Link'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Backorder banner */}
                {hasBackorder && (
                    <div className="mx-6 mt-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2 shrink-0">
                        <span className="text-base">📋</span>
                        <p className="text-xs text-orange-700 font-medium">Some items have backorders — supplier will deliver outstanding quantities later.</p>
                    </div>
                )}

                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0 mt-3">
                    {[
                        { label: 'Received Date', value: receipt.received_date },
                        { label: 'Items Received', value: `${totalReceived} units` },
                        { label: 'Matched to Stock', value: `${matched} / ${receipt.items?.length ?? 0} lines` },
                    ].map(c => (
                        <div key={c.label} className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{c.label}</p>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{c.value}</p>
                        </div>
                    ))}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {receipt.delivery_note_number && (
                        <p className="text-xs text-gray-500 mb-3">
                            Delivery Note #: <span className="font-mono font-semibold text-gray-800">{receipt.delivery_note_number}</span>
                        </p>
                    )}

                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 rounded-lg">
                                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Art #</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase tracking-wider">Ordered</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                                <th className="px-3 py-2 text-center font-semibold text-orange-600 uppercase tracking-wider">Backorder</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(receipt.items ?? []).map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2.5 text-gray-800 font-medium">{item.name}</td>
                                    <td className="px-3 py-2.5 font-mono text-gray-400">{item.article_number || '—'}</td>
                                    <td className="px-3 py-2.5 text-center text-gray-500">{item.ordered_qty ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-center font-bold text-gray-900">{item.received_qty}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        {(item.backorder_qty ?? 0) > 0
                                            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{item.backorder_qty} pending</span>
                                            : <span className="text-gray-300">—</span>
                                        }
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {item.received_qty === 0
                                            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">⏳ Backordered</span>
                                            : item.matched
                                                ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Matched</span>
                                                : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">? Unmatched</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {receipt.notes && (
                        <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{receipt.notes}</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        {receipt.pdf_url && (
                            <a
                                href={receipt.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg transition-colors"
                            >
                                📄 View PDF
                            </a>
                        )}
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GoodsReceiptsPage() {
    return (
        <Suspense>
            <GoodsReceiptsContent />
        </Suspense>
    )
}

function GoodsReceiptsContent() {
    const searchParams = useSearchParams()
    const [receipts, setReceipts]   = useState<GoodsReceipt[]>([])
    const [loading,  setLoading]    = useState(true)
    const [search,   setSearch]     = useState('')
    const [selected, setSelected]   = useState<GoodsReceipt | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm]           = useState(EMPTY_FORM)
    const [saving, setSaving]       = useState(false)
    const [saveError, setSaveError] = useState('')

    const load = useCallback(async () => {
        const dealershipId = getDealershipId()
        if (!dealershipId) { setLoading(false); return }

        const { data: receiptsData } = await supabase
            .from('goods_receipts')
            .select('*')
            .eq('dealership_id', dealershipId)
            .order('received_date', { ascending: false })

        if (!receiptsData) { setLoading(false); return }

        // Fetch items in a separate query to avoid RLS issues with nested selects
        const receiptIds = receiptsData.map(r => r.id)
        const { data: itemsData } = receiptIds.length > 0
            ? await supabase.from('goods_receipt_items').select('*').in('receipt_id', receiptIds)
            : { data: [] }

        const receiptsWithItems = receiptsData.map(r => ({
            ...r,
            items: (itemsData ?? []).filter((i: ReceiptItem & { receipt_id: string }) => i.receipt_id === r.id),
        }))

        setReceipts(receiptsWithItems as GoodsReceipt[])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    // Auto-open a specific receipt when navigating from a notification link (?receipt=GR-xxx)
    useEffect(() => {
        const receiptId = searchParams.get('receipt')
        if (!receiptId || receipts.length === 0) return
        const match = receipts.find(r => r.id === receiptId)
        if (match) setSelected(match)
    }, [searchParams, receipts])

    const filtered = receipts.filter(r => {
        const q = search.toLowerCase()
        return (
            r.id.toLowerCase().includes(q) ||
            r.vendor.toLowerCase().includes(q) ||
            (r.po_id ?? '').toLowerCase().includes(q) ||
            (r.delivery_note_number ?? '').toLowerCase().includes(q)
        )
    })

    // ── Stats ────────────────────────────────────────────────────────────────
    const totalUnits    = receipts.reduce((s, r) => s + (r.items?.reduce((a, i) => a + i.received_qty, 0) ?? 0), 0)
    const pendingCount  = receipts.filter(r => r.status === 'pending_approval').length

    // ── Manual create ────────────────────────────────────────────────────────
    function setItem(idx: number, field: string, val: string) {
        setForm(f => {
            const items = [...f.items]
            items[idx] = { ...items[idx], [field]: val }
            return { ...f, items }
        })
    }

    function addItemRow() {
        setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))
    }

    function removeItemRow(idx: number) {
        setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
    }

    async function handleSave() {
        if (!form.vendor || !form.received_date) return
        setSaving(true)
        setSaveError('')

        try {
            const dealershipId = getDealershipId()
            const tag = getDealershipTag()
            const { count } = await supabase
                .from('goods_receipts')
                .select('id', { count: 'exact', head: true })
                .eq('dealership_id', dealershipId)

            const receiptId = makeGrId(tag, count ?? 0)

            const { error } = await supabase.from('goods_receipts').insert({
                id:                   receiptId,
                dealership_id:        dealershipId,
                po_id:                form.po_id || null,
                vendor:               form.vendor.trim(),
                delivery_note_number: form.delivery_note_number || null,
                received_date:        form.received_date,
                received_by:          form.received_by || null,
                notes:                form.notes || null,
                source:               'manual',
                status:               'approved',
            })
            if (error) throw new Error(error.message)

            // Insert items + update stock
            for (const item of form.items) {
                if (!item.name || !item.received_qty) continue

                const receivedQty = parseInt(item.received_qty) || 0

                // Try to match by article number or name
                let inventoryId: string | null = null
                let matched = false

                if (item.article_number) {
                    for (const table of ['motorcycles', 'spare_parts', 'accessories'] as const) {
                        const { data } = await supabase
                            .from(table)
                            .select('id, stock')
                            .eq('dealership_id', dealershipId)
                            .eq('article_number', item.article_number)
                            .maybeSingle()
                        if (data) {
                            inventoryId = data.id
                            matched = true
                            const newStock = (data.stock ?? 0) + receivedQty
                            await supabase.from(table).update({ stock: newStock }).eq('id', data.id).eq('dealership_id', dealershipId)
                            break
                        }
                    }
                }

                await supabase.from('goods_receipt_items').insert({
                    receipt_id:     receiptId,
                    inventory_id:   inventoryId,
                    article_number: item.article_number || null,
                    name:           item.name.trim(),
                    ordered_qty:    item.ordered_qty ? parseInt(item.ordered_qty) : null,
                    received_qty:   receivedQty,
                    unit_cost:      item.unit_cost ? parseFloat(item.unit_cost) : null,
                    matched,
                })
            }

            setShowCreate(false)
            setForm(EMPTY_FORM)
            await load()
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex min-h-screen bg-[#f5f7fa]">
            <Sidebar />
            <div className="lg:ml-64 flex-1 flex flex-col">
                <div className="brand-top-bar" />

                <div className="p-6 flex-1 flex flex-col max-w-6xl w-full">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Purchasing</p>
                            <h1 className="text-2xl font-black text-gray-900">Goods Receipts</h1>
                            <p className="text-sm text-gray-400 mt-0.5">Track incoming deliveries — auto-captured from email or entered manually</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search receipts..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 w-56"
                                />
                            </div>
                            <button
                                onClick={() => { setForm(EMPTY_FORM); setSaveError(''); setShowCreate(true) }}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                + Manual Entry
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                            { label: 'Total Receipts',    value: receipts.length, icon: '📦', color: 'border-l-orange-400' },
                            { label: 'Units Received',    value: totalUnits,      icon: '📊', color: 'border-l-blue-400' },
                            { label: 'Pending Approval',  value: pendingCount,    icon: '⏳', color: 'border-l-amber-400' },
                        ].map(s => (
                            <div key={s.label} className={`bg-white border border-gray-200 border-l-4 ${s.color} rounded-xl p-4 shadow-sm`}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</p>
                                    <span className="text-lg">{s.icon}</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-48">
                                <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <span className="text-5xl">📦</span>
                                <div className="text-center">
                                    <p className="text-gray-700 font-semibold">
                                        {receipts.length === 0 ? 'No goods receipts yet' : 'No results match your search'}
                                    </p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        {receipts.length === 0
                                            ? 'Create a manual entry or wait for an incoming delivery email'
                                            : 'Try a different search term'}
                                    </p>
                                </div>
                                {receipts.length === 0 && (
                                    <button
                                        onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }}
                                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                                    >
                                        + Create First Receipt
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Receipt ID</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PO #</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Delivery Note</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Received Date</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Lines</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Units</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filtered.map(r => {
                                            const units = r.items?.reduce((s, i) => s + i.received_qty, 0) ?? 0
                                            return (
                                                <tr
                                                    key={r.id}
                                                    onClick={() => setSelected(r)}
                                                    className="hover:bg-orange-50/40 transition-colors cursor-pointer group"
                                                >
                                                    <td className="px-4 py-3 font-mono text-xs font-bold text-orange-500 whitespace-nowrap">{r.id}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-800 font-medium max-w-45 truncate">{r.vendor}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{r.po_id || '—'}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{r.delivery_note_number || '—'}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.received_date}</td>
                                                    <td className="px-4 py-3 text-xs text-center text-gray-700 font-semibold">{r.items?.length ?? 0}</td>
                                                    <td className="px-4 py-3 text-xs text-center font-bold text-gray-900">{units}</td>
                                                    <td className="px-4 py-3"><SourceBadge source={r.source} /></td>
                                                    <td className="px-4 py-3"><StatusBadge status={r.status ?? 'approved'} /></td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail modal */}
            {selected && (
                <DetailModal
                    receipt={selected}
                    onClose={() => setSelected(null)}
                    onStatusChange={(id, status) => {
                        setReceipts(rs => rs.map(r => r.id === id ? { ...r, status } : r))
                        setSelected(null)
                    }}
                    onPoRelinked={(id, newPoId) => {
                        setReceipts(rs => rs.map(r => r.id === id ? { ...r, po_id: newPoId } : r))
                        setSelected(s => s ? { ...s, po_id: newPoId } : s)
                    }}
                />
            )}

            {/* Manual create modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div
                        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Manual Goods Receipt</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Record items received — stock updates automatically when article # matches</p>
                            </div>
                            <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-bold">✕</button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                            {/* Header fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor <span className="text-red-500">*</span></label>
                                    <input type="text" placeholder="Supplier name" value={form.vendor}
                                        onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Received Date <span className="text-red-500">*</span></label>
                                    <input type="date" value={form.received_date}
                                        onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Link to PO # (optional)</label>
                                    <input type="text" placeholder="e.g. PO-AVA-2026-001" value={form.po_id}
                                        onChange={e => setForm(f => ({ ...f, po_id: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Note # (optional)</label>
                                    <input type="text" placeholder="From physical document" value={form.delivery_note_number}
                                        onChange={e => setForm(f => ({ ...f, delivery_note_number: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Received By (optional)</label>
                                    <input type="text" placeholder="Staff name" value={form.received_by}
                                        onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
                                    <input type="text" placeholder="Any delivery remarks" value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400" />
                                </div>
                            </div>

                            {/* Line items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Line Items</label>
                                    <button onClick={addItemRow} className="text-xs text-orange-500 hover:text-orange-700 font-semibold flex items-center gap-1">
                                        + Add Row
                                    </button>
                                </div>
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Item Name *</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Art #</th>
                                                <th className="px-3 py-2 text-center font-semibold text-gray-500">Ordered</th>
                                                <th className="px-3 py-2 text-center font-semibold text-gray-500">Received *</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Unit Cost</th>
                                                <th className="px-3 py-2" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {form.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-2 py-1.5">
                                                        <input type="text" placeholder="e.g. Brake Pads" value={item.name}
                                                            onChange={e => setItem(idx, 'name', e.target.value)}
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-orange-400" />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <input type="text" placeholder="SP-001" value={item.article_number}
                                                            onChange={e => setItem(idx, 'article_number', e.target.value)}
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono text-gray-800 focus:outline-none focus:border-orange-400" />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <input type="number" min="0" placeholder="10" value={item.ordered_qty}
                                                            onChange={e => setItem(idx, 'ordered_qty', e.target.value)}
                                                            className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-800 focus:outline-none focus:border-orange-400" />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <input type="number" min="0" placeholder="5" value={item.received_qty}
                                                            onChange={e => setItem(idx, 'received_qty', e.target.value)}
                                                            className="w-16 bg-gray-50 border border-orange-200 rounded-lg px-2 py-1 text-xs text-center font-bold text-gray-800 focus:outline-none focus:border-orange-400" />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <input type="number" min="0" step="0.01" placeholder="0.00" value={item.unit_cost}
                                                            onChange={e => setItem(idx, 'unit_cost', e.target.value)}
                                                            className="w-24 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-orange-400" />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        {form.items.length > 1 && (
                                                            <button onClick={() => removeItemRow(idx)} className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none">×</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1.5">💡 If Article # matches an inventory item, stock is updated automatically on save.</p>
                            </div>

                            {saveError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{saveError}</div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.vendor || !form.received_date}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                {saving ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Receipt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
