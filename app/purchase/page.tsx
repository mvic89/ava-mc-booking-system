'use client'

import { useState, useMemo, useEffect } from 'react'
import { useInventory }   from '@/context/InventoryContext'
import { supabase }       from '@/lib/supabase'
import { getDealershipId } from '@/lib/tenant'
import { vendorDetails }  from '@/data/vendors'
import { POModal, STATUS_STYLE, formatCurrency, qtyKey, VendorItem } from '@/components/POModal'
import { CreatePOModal, FlatInventoryItem } from '@/components/CreatePOModal'
import { POLineItem, POStatus, PurchaseOrder } from '@/utils/types'

const ALL_STATUSES: POStatus[] = ['Draft', 'Under Review', 'Reviewed', 'Sent', 'Received']

// ─── PO number generator ──────────────────────────────────────────────────────

function generateNextPOId(allPOs: PurchaseOrder[]): string {
    const year = new Date().getFullYear()
    const nums = allPOs.map((po) => {
        const m = po.id.match(/^PO-\d{4}-(\d+)$/)
        return m ? parseInt(m[1], 10) : 0
    })
    const max = nums.length > 0 ? Math.max(...nums) : 0
    return `PO-${year}-${String(max + 1).padStart(3, '0')}`
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ allPOs, filtered }: { allPOs: PurchaseOrder[]; filtered: PurchaseOrder[] }) {
    const totalValue  = filtered.reduce((s, p) => s + p.totalCost, 0)
    const underReview = allPOs.filter((p) => p.status === 'Under Review').length
    const draft       = allPOs.filter((p) => p.status === 'Draft').length

    const cards = [
        { label: 'Total POs',       value: String(allPOs.length),       icon: '📦', color: 'bg-blue-50 text-blue-700'   },
        { label: 'Under Review',    value: String(underReview),         icon: '🔍', color: 'bg-amber-50 text-amber-700' },
        { label: 'Draft',           value: String(draft),               icon: '📝', color: 'bg-gray-100 text-gray-700'  },
        { label: 'Displayed Value', value: formatCurrency(totalValue),  icon: '💰', color: 'bg-green-50 text-green-700' },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {cards.map((c) => (
                <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
                    <div className="text-xl mb-1">{c.icon}</div>
                    <div className="text-xs font-medium opacity-70 mb-0.5">{c.label}</div>
                    <div className="text-lg font-bold">{c.value}</div>
                </div>
            ))}
        </div>
    )
}

// ─── Auto-PO info banner ──────────────────────────────────────────────────────

function AutoPOBanner({ autoPOs, allInventoryCount }: { autoPOs: PurchaseOrder[]; allInventoryCount: number }) {
    const [open, setOpen] = useState(false)

    const critical = autoPOs.filter((p) => p.status === 'Under Review')
    const draft    = autoPOs.filter((p) => p.status === 'Draft')

    if (autoPOs.length === 0) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-2 text-sm text-green-700">
                <span>✅</span>
                <span>All {allInventoryCount} inventory items are above their reorder points — no POs needed right now.</span>
            </div>
        )
    }

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl mb-5 overflow-hidden">
            <button
                onClick={() => setOpen((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
                <div className="flex items-center gap-3 text-sm text-amber-800 font-medium">
                    <span>⚡</span>
                    <span>
                        {autoPOs.length} auto-generated PO{autoPOs.length > 1 ? 's' : ''} from low-stock inventory
                        {critical.length > 0 && (
                            <span className="ml-2 bg-amber-200 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">
                                {critical.length} urgent
                            </span>
                        )}
                    </span>
                </div>
                <span className="text-amber-500 text-xs shrink-0 ml-4">{open ? '▲ hide' : '▼ show'}</span>
            </button>

            {open && (
                <div className="border-t border-amber-200 px-4 pb-4 pt-3 space-y-2">
                    <p className="text-xs text-amber-700 mb-3">
                        These POs are auto-generated and update live when inventory stock changes.
                    </p>
                    {[...critical, ...draft].map((po) => {
                        const isCritical = po.status === 'Under Review'
                        return (
                            <div
                                key={po.id}
                                className={`rounded-lg border px-3 py-2 flex items-start justify-between gap-4 text-xs ${
                                    isCritical ? 'border-amber-300 bg-amber-100' : 'border-gray-200 bg-white'
                                }`}
                            >
                                <div>
                                    <span className="font-mono font-bold text-gray-700">{po.id}</span>
                                    <span className="mx-2 text-gray-400">·</span>
                                    <span className="font-medium text-gray-700">{po.vendor}</span>
                                    <span className="mx-2 text-gray-400">·</span>
                                    <span className="text-gray-500">{po.items.length} item{po.items.length > 1 ? 's' : ''}</span>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="font-bold text-gray-800">{formatCurrency(po.totalCost)}</div>
                                    <div className={`mt-0.5 font-semibold ${isCritical ? 'text-amber-700' : 'text-gray-400'}`}>
                                        {po.status}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchasePage() {
    const { autoPOs, motorcycles, spareParts, accessories } = useInventory()
    const allInventoryCount = motorcycles.length + spareParts.length + accessories.length

    const [activeStatus,      setActiveStatus]      = useState<POStatus | 'All'>('All')
    const [search,            setSearch]            = useState('')
    const [selectedPO,        setSelectedPO]        = useState<PurchaseOrder | null>(null)
    const [qtyOverrides,      setQtyOverrides]      = useState<Record<string, number>>({})
    const [showCreatePO,      setShowCreatePO]      = useState(false)
    const [userPOs,           setUserPOs]           = useState<PurchaseOrder[]>([])
    const [historicalPOs,     setHistoricalPOs]     = useState<PurchaseOrder[]>([])
    const [poStatusOverrides, setPoStatusOverrides] = useState<Record<string, POStatus>>({})
    const [poItemOverrides,   setPoItemOverrides]   = useState<Record<string, POLineItem[]>>({})
    const [poEtaOverrides,    setPoEtaOverrides]    = useState<Record<string, string>>({})

    // Fetch POs from Supabase on mount; also load status overrides for auto-POs
    useEffect(() => {
        async function loadHistoricalPOs() {
            const dealershipId = getDealershipId()
            if (!dealershipId) return
            const { data: orders } = await supabase.from('purchase_orders').select('*').eq('dealership_id', dealershipId)
            // po_line_items are scoped via po_id FK; fetch only items for this dealer's POs
            const poIds = (orders ?? []).map((o) => o.id)
            const { data: items } = poIds.length > 0
                ? await supabase.from('po_line_items').select('*').in('po_id', poIds)
                : { data: [] }
            if (!orders) return
            // Populate status overrides for ALL POs (including auto-POs saved to DB)
            const overrides: Record<string, POStatus> = {}
            orders.forEach((po) => { overrides[po.id] = po.status as POStatus })
            setPoStatusOverrides(overrides)
            const mapped: PurchaseOrder[] = orders.map((po) => ({
                id:        po.id,
                vendor:    po.vendor,
                date:      po.date,
                eta:       po.eta,
                status:    po.status as POStatus,
                totalCost: Number(po.total_cost),
                notes:     po.notes ?? undefined,
                items: (items ?? [])
                    .filter((li) => li.po_id === po.id)
                    .map((li) => ({
                        inventoryId:   li.inventory_id,
                        name:          li.name,
                        articleNumber: li.article_number,
                        orderQty:      li.order_qty,
                        unitCost:      Number(li.unit_cost),
                        lineTotal:     Number(li.line_total),
                        ...(li.size ? { size: li.size } : {}),
                    })),
            }))
            setHistoricalPOs(mapped)
        }
        loadHistoricalPOs()
    }, [])

    const autoIds = useMemo(() => new Set(autoPOs.map((p) => p.id)), [autoPOs])
    // Deduplicate: auto-POs come from live inventory; filter them out of historicalPOs to avoid duplicate keys
    const allPOs  = useMemo<PurchaseOrder[]>(
        () => [...autoPOs, ...userPOs, ...historicalPOs.filter((p) => !autoIds.has(p.id))],
        [autoPOs, userPOs, historicalPOs, autoIds],
    )

    const allPOsResolved = useMemo<PurchaseOrder[]>(
        () => allPOs.map((po) => {
            const status    = poStatusOverrides[po.id]
            const items     = poItemOverrides[po.id]
            const eta       = poEtaOverrides[po.id]
            if (!status && !items && !eta) return po
            return {
                ...po,
                ...(status ? { status } : {}),
                ...(items  ? { items, totalCost: items.reduce((s, li) => s + li.lineTotal, 0) } : {}),
                ...(eta    ? { eta }   : {}),
            }
        }),
        [allPOs, poStatusOverrides, poItemOverrides, poEtaOverrides],
    )

    const allInventoryItems = useMemo<FlatInventoryItem[]>(() => [
        ...motorcycles.map((m) => ({ id: m.id, name: m.name, articleNumber: m.articleNumber, vendor: m.vendor, cost: m.cost })),
        ...spareParts.map((s)  => ({ id: s.id, name: s.name, articleNumber: s.articleNumber, vendor: s.vendor, cost: s.cost })),
        ...accessories.map((a) => ({ id: a.id, name: a.name, articleNumber: a.articleNumber, vendor: a.vendor, cost: a.cost, size: a.size })),
    ], [motorcycles, spareParts, accessories])

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: allPOsResolved.length }
        ALL_STATUSES.forEach((s) => { counts[s] = allPOsResolved.filter((p) => p.status === s).length })
        return counts
    }, [allPOsResolved])

    const filtered = useMemo(() => allPOsResolved.filter((po) => {
        const matchStatus = activeStatus === 'All' || po.status === activeStatus
        const q = search.toLowerCase()
        const matchSearch =
            !q ||
            po.id.toLowerCase().includes(q) ||
            po.vendor.toLowerCase().includes(q) ||
            po.items.some(
                (li) =>
                    li.name.toLowerCase().includes(q) ||
                    li.articleNumber.toLowerCase().includes(q) ||
                    li.inventoryId.toLowerCase().includes(q)
            )
        return matchStatus && matchSearch
    }), [allPOsResolved, activeStatus, search])

    function handleAdjust(poId: string, inventoryId: string, delta: number) {
        const key = qtyKey(poId, inventoryId)
        setQtyOverrides((prev) => {
            const po = allPOs.find((p) => p.id === poId)
            const li = po?.items.find((i) => i.inventoryId === inventoryId)
            const current = prev[key] ?? li?.orderQty ?? 1
            return { ...prev, [key]: Math.max(1, current + delta) }
        })
    }

    function handleSavePO(po: PurchaseOrder) {
        const dealershipId = getDealershipId()
        if (!dealershipId) return
        // Optimistic update
        setUserPOs((prev) => [po, ...prev])
        // Persist to Supabase in background
        supabase.from('purchase_orders').insert({
            id:            po.id,
            vendor:        po.vendor,
            date:          po.date,
            eta:           po.eta,
            status:        po.status,
            total_cost:    po.totalCost,
            notes:         po.notes ?? null,
            dealership_id: dealershipId,
        }).then(() => {
            if (po.items.length > 0) {
                supabase.from('po_line_items').insert(
                    po.items.map((li) => ({
                        po_id:          po.id,
                        inventory_id:   li.inventoryId,
                        name:           li.name,
                        article_number: li.articleNumber,
                        order_qty:      li.orderQty,
                        unit_cost:      li.unitCost,
                        line_total:     li.lineTotal,
                        size:           li.size ?? null,
                    }))
                )
            }
        })
    }

    async function handleSentPO(poId: string) {
        setPoStatusOverrides((prev) => ({ ...prev, [poId]: 'Sent' }))
        setSelectedPO(null)
        const po = allPOs.find((p) => p.id === poId)
        if (po) {
            await supabase.from('purchase_orders').upsert({
                id:         poId,
                vendor:     po.vendor,
                date:       po.date,
                eta:        po.eta,
                status:     'Sent',
                total_cost: po.totalCost,
                notes:      po.notes ?? null,
            }, { onConflict: 'id' })
            await supabase.from('po_line_items').delete().eq('po_id', poId)
            if (po.items.length > 0) {
                await supabase.from('po_line_items').insert(
                    po.items.map((li) => ({
                        po_id:          poId,
                        inventory_id:   li.inventoryId,
                        name:           li.name,
                        article_number: li.articleNumber,
                        order_qty:      li.orderQty,
                        unit_cost:      li.unitCost,
                        line_total:     li.lineTotal,
                        size:           li.size ?? null,
                    }))
                )
            }
        }
    }

    async function handleReviewedPO(poId: string, items: POLineItem[], eta: string) {
        setPoStatusOverrides((prev) => ({ ...prev, [poId]: 'Reviewed' }))
        setPoItemOverrides((prev)   => ({ ...prev, [poId]: items }))
        setPoEtaOverrides((prev)    => ({ ...prev, [poId]: eta }))
        setSelectedPO(null)
        const po = allPOs.find((p) => p.id === poId)
        if (po) {
            const total = items.reduce((s, li) => s + li.lineTotal, 0)
            await supabase.from('purchase_orders').upsert({
                id:         poId,
                vendor:     po.vendor,
                date:       po.date,
                eta:        eta || po.eta,
                status:     'Reviewed',
                total_cost: total || po.totalCost,
                notes:      po.notes ?? null,
            }, { onConflict: 'id' })
            await supabase.from('po_line_items').delete().eq('po_id', poId)
            if (items.length > 0) {
                await supabase.from('po_line_items').insert(
                    items.map((li) => ({
                        po_id:          poId,
                        inventory_id:   li.inventoryId,
                        name:           li.name,
                        article_number: li.articleNumber,
                        order_qty:      li.orderQty,
                        unit_cost:      li.unitCost,
                        line_total:     li.lineTotal,
                        size:           li.size ?? null,
                    }))
                )
            }
        }
    }

    const selectedVendorItems = useMemo<VendorItem[]>(() => {
        if (!selectedPO) return []
        return allInventoryItems
            .filter((i) => i.vendor === selectedPO.vendor)
            .map(({ id, name, articleNumber, cost, size }) => ({ id, name, articleNumber, cost, size }))
    }, [selectedPO, allInventoryItems])

    const nextPOId = useMemo(() => generateNextPOId(allPOs), [allPOs])
    const tabs: (POStatus | 'All')[] = ['All', ...ALL_STATUSES]

    return (
        <div className="lg:ml-64 min-h-screen flex flex-col bg-white">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
                <span className="text-sm text-gray-500 font-medium">Purchase Orders</span>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Search PO, vendor, item..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 w-60"
                    />
                </div>
            </div>

            {/* Page body */}
            <div className="flex-1 overflow-auto p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Click any row to open the full PO. Auto POs update live with inventory stock.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreatePO(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                        + Create PO
                    </button>
                </div>

                <SummaryCards allPOs={allPOsResolved} filtered={filtered} />
                <AutoPOBanner autoPOs={autoPOs} allInventoryCount={allInventoryCount} />

                {/* Status tabs */}
                <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveStatus(tab)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                activeStatus === tab
                                    ? 'bg-orange-500 text-white'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            {tab}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                activeStatus === tab ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                                {statusCounts[tab] ?? 0}
                            </span>
                        </button>
                    ))}
                </div>

                {/* PO table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <span className="text-3xl mb-2">📭</span>
                            <p className="text-sm">No purchase orders match your filter</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500 tracking-wider">
                                    <th className="px-4 py-3">PO Number</th>
                                    <th className="py-3 pr-4">Vendor</th>
                                    <th className="py-3 pr-4">Date</th>
                                    <th className="py-3 pr-4">Items</th>
                                    <th className="py-3 pr-4">Total Cost</th>
                                    <th className="py-3 pr-4">ETA</th>
                                    <th className="py-3 pr-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((po) => {
                                    const displayStatus = poStatusOverrides[po.id] ?? po.status
                                    const style    = STATUS_STYLE[displayStatus] ?? STATUS_STYLE['Draft']
                                    const isAuto   = autoIds.has(po.id)
                                    const effTotal = po.items.reduce((sum, li) => {
                                        const qty = qtyOverrides[qtyKey(po.id, li.inventoryId)] ?? li.orderQty
                                        return sum + qty * li.unitCost
                                    }, 0)
                                    return (
                                        <tr
                                            key={po.id}
                                            onClick={() => setSelectedPO(po)}
                                            className={`border-b border-gray-100 hover:bg-orange-50 transition-colors cursor-pointer ${isAuto ? 'bg-amber-50/30' : ''}`}
                                        >
                                            <td className="py-3.5 pl-4 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-sm font-semibold text-gray-800">{po.id}</span>
                                                    {isAuto && (
                                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">AUTO</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 pr-4 text-gray-700 text-sm max-w-55 truncate" title={po.vendor}>{po.vendor}</td>
                                            <td className="py-3.5 pr-4 text-gray-500 text-sm">{po.date}</td>
                                            <td className="py-3.5 pr-4">
                                                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                                    {po.items.length} item{po.items.length !== 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td className="py-3.5 pr-4 text-gray-800 font-semibold text-sm">{formatCurrency(effTotal)}</td>
                                            <td className="py-3.5 pr-4 text-gray-500 text-sm">{po.eta}</td>
                                            <td className="py-3.5 pr-4">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                    {displayStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Create PO modal — see components/CreatePOModal.tsx */}
            {showCreatePO && (
                <CreatePOModal
                    nextPOId={nextPOId}
                    allInventoryItems={allInventoryItems}
                    onSave={handleSavePO}
                    onClose={() => setShowCreatePO(false)}
                />
            )}

            {/* PO detail / review modal — see components/POModal.tsx */}
            {selectedPO && (
                <POModal
                    po={{ ...selectedPO, status: poStatusOverrides[selectedPO.id] ?? selectedPO.status }}
                    isAuto={autoIds.has(selectedPO.id)}
                    qtyOverrides={qtyOverrides}
                    onAdjust={handleAdjust}
                    onClose={() => setSelectedPO(null)}
                    onSent={() => handleSentPO(selectedPO.id)}
                    onReviewed={(items, eta) => handleReviewedPO(selectedPO.id, items, eta)}
                    vendorItems={selectedVendorItems}
                    freeShippingThreshold={vendorDetails[selectedPO.vendor]?.freeShippingThreshold}
                />
            )}
        </div>
    )
}
