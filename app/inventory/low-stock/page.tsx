'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useInventory } from '@/context/InventoryContext'
import { supabase } from '@/lib/supabase'
import { getDealershipId, getDealershipTag } from '@/lib/tenant'
import { CreatePOModal, FlatInventoryItem } from '@/components/CreatePOModal'
import { POLineItem, POStatus, PurchaseOrder, LowStockAlert } from '@/utils/types'
import Sidebar from '@/components/Sidebar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function poIdToRefNo(poId: string): string {
    return poId.replace(/^PO-/, 'REF-')
}

async function generateNextPOId(tag: string): Promise<string> {
    const year   = new Date().getFullYear()
    const prefix = `PO-${tag}-${year}-`
    const { data } = await supabase
        .from('purchase_orders')
        .select('id')
        .like('id', `${prefix}%`)
        .order('id', { ascending: false })
        .limit(1)
    const lastNum = data?.[0]?.id ? parseInt(data[0].id.split('-').pop() ?? '0', 10) : 0
    return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}

const ITEM_TYPE_ICON: Record<LowStockAlert['itemType'], string> = {
    motorcycle: '🏍',
    sparePart:  '🔧',
    accessory:  '🧢',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplierGroup {
    vendor:  string
    alerts:  LowStockAlert[]
    /** Resolved FlatInventoryItems — may be fewer than alerts if inventory not yet loaded */
    items:   Array<{ item: FlatInventoryItem; qty: number }>
}

// ─── Nav tabs (mirrors the tabs in _shared.tsx) ───────────────────────────────

const NAV_TABS = [
    { id: 'motorcycles', label: 'Motorcycles', icon: '🏍️', href: '/inventory/motorcycles' },
    { id: 'spareParts',  label: 'Spare Parts',  icon: '🔧', href: '/inventory/spare-parts'  },
    { id: 'accessories', label: 'Accessories',  icon: '🪖', href: '/inventory/accessories'  },
    { id: 'lowStock',    label: 'Low Stock',    icon: '⚠',  href: '/inventory/low-stock'   },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryLowStockPage() {
    const { lowStockAlerts, motorcycles, spareParts, accessories } = useInventory()

    const [nextPOId,        setNextPOId]        = useState('')
    const [dealerSuppliers, setDealerSuppliers] = useState<string[]>([])
    const [vendorEmails,    setVendorEmails]    = useState<Record<string, string>>({})
    const [openPOs,         setOpenPOs]         = useState<PurchaseOrder[]>([])
    const [supplierFilter,  setSupplierFilter]  = useState('')

    // "Mark as Ordered" inline form — which vendor's form is open + the ref input value
    const [orderingVendor,  setOrderingVendor]  = useState<string | null>(null)
    const [portalOrderRef,  setPortalOrderRef]  = useState('')

    // Stores the vendor + ONLY the items to pre-fill when the CreatePO modal opens.
    const [modalConfig, setModalConfig] = useState<{
        vendor: string
        items:  Array<{ item: FlatInventoryItem; qty: number }>
    } | null>(null)

    // Fetch a fresh PO ID from DB every time a modal opens so each supplier
    // group gets a unique sequential number (not the same cached value).
    useEffect(() => {
        if (!modalConfig) return
        const tag = getDealershipTag()
        generateNextPOId(tag).then(setNextPOId)
    }, [modalConfig])

    useEffect(() => {
        const id  = getDealershipId()
        const tag = getDealershipTag()
        if (!id) return

        generateNextPOId(tag).then(setNextPOId)

        supabase
            .from('vendors')
            .select('name, email')
            .eq('dealership_id', id)
            .eq('is_manual', true)
            .order('name')
            .then(({ data }) => {
                if (data) {
                    setDealerSuppliers(data.map((r) => r.name))
                    const emailMap: Record<string, string> = {}
                    data.forEach((r) => { if (r.email) emailMap[r.name] = r.email })
                    setVendorEmails(emailMap)
                }
            })

        async function loadOpenPOs() {
            const { data: orders } = await supabase
                .from('purchase_orders')
                .select('*')
                .eq('dealership_id', id!)
                .neq('status', 'Received')
            if (!orders || orders.length === 0) return
            const poIds = orders.map((o) => o.id)
            const { data: items } = await supabase
                .from('po_line_items').select('*').in('po_id', poIds)
            const mapped: PurchaseOrder[] = orders.map((po) => ({
                id:               po.id,
                refNo:            poIdToRefNo(po.id),
                vendor:           po.vendor,
                date:             po.date,
                eta:              po.eta,
                status:           po.status as POStatus,
                totalCost:        Number(po.total_cost),
                notes:            po.notes ?? undefined,
                supplierOrderRef: po.supplier_order_ref ?? undefined,
                placedAt:         po.placed_at ?? undefined,
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
            setOpenPOs(mapped)
        }
        loadOpenPOs()
    }, [])

    const allInventoryItems = useMemo<FlatInventoryItem[]>(() => [
        ...motorcycles.map((m) => ({ id: m.id, name: m.name, articleNumber: m.articleNumber, vendor: m.vendor, cost: m.cost })),
        ...spareParts.map((s)  => ({ id: s.id, name: s.name, articleNumber: s.articleNumber, vendor: s.vendor, cost: s.cost })),
        ...accessories.map((a) => ({ id: a.id, name: a.name, articleNumber: a.articleNumber, vendor: a.vendor, cost: a.cost, size: a.size })),
    ], [motorcycles, spareParts, accessories])

    // ── Group alerts by supplier, resolve FlatInventoryItems per alert ────────
    const supplierGroups = useMemo<SupplierGroup[]>(() => {
        const map = new Map<string, LowStockAlert[]>()
        for (const alert of lowStockAlerts) {
            if (!map.has(alert.vendor)) map.set(alert.vendor, [])
            map.get(alert.vendor)!.push(alert)
        }
        return [...map.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([vendor, alerts]) => ({
                vendor,
                alerts,
                items: alerts
                    .map((alert) => {
                        const item = allInventoryItems.find((i) => i.id === alert.inventoryId)
                        return item ? { item, qty: alert.reorderQty } : null
                    })
                    .filter((x): x is { item: FlatInventoryItem; qty: number } => x !== null),
            }))
    }, [lowStockAlerts, allInventoryItems])

    const allSuppliers = useMemo(
        () => [...new Set([...lowStockAlerts.map((a) => a.vendor), ...dealerSuppliers])].sort(),
        [lowStockAlerts, dealerSuppliers],
    )

    const visibleGroups = supplierFilter
        ? supplierGroups.filter((g) => g.vendor === supplierFilter)
        : supplierGroups

    // ── PO handlers ───────────────────────────────────────────────────────────

    async function handleSavePO(po: PurchaseOrder) {
        const dealershipId = getDealershipId()
        if (!dealershipId) return
        const tag     = getDealershipTag()
        const freshId = await generateNextPOId(tag)
        const poToSave = { ...po, id: freshId, refNo: poIdToRefNo(freshId) }

        const { error: poErr } = await supabase.from('purchase_orders').insert({
            id:            poToSave.id,
            vendor:        poToSave.vendor,
            date:          poToSave.date,
            eta:           poToSave.eta,
            status:        poToSave.status,
            total_cost:    poToSave.totalCost,
            notes:         poToSave.notes ?? null,
            dealership_id: dealershipId,
        })
        if (poErr) { console.error('[Low Stock] PO insert failed:', poErr.message); return }

        if (poToSave.items.length > 0) {
            await supabase.from('po_line_items').insert(
                poToSave.items.map((li) => ({
                    po_id:          poToSave.id,
                    inventory_id:   li.inventoryId,
                    name:           li.name,
                    article_number: li.articleNumber,
                    order_qty:      li.orderQty,
                    unit_cost:      li.unitCost,
                    line_total:     li.lineTotal,
                    size:           li.size ?? null,
                })),
            )
        }
        generateNextPOId(tag).then(setNextPOId)
        setOpenPOs((prev) => [...prev, poToSave])
    }

    async function handleAddToExistingPO(poId: string, newItems: POLineItem[], newEta?: string) {
        const dealershipId = getDealershipId()
        const existingPO   = openPOs.find((p) => p.id === poId)
        if (!existingPO) return

        type ItemWithFlag = POLineItem & { _replaceExisting?: boolean }
        const replaceItems = (newItems as ItemWithFlag[]).filter((i) => i._replaceExisting)
        const appendItems  = (newItems as ItemWithFlag[]).filter((i) => !i._replaceExisting)

        const updated = existingPO.items.map((ex) => {
            const r = replaceItems.find(
                (ri) => ri.inventoryId === ex.inventoryId && (ri.size ?? '') === (ex.size ?? ''),
            )
            return r ? { ...ex, orderQty: r.orderQty, lineTotal: r.lineTotal } : ex
        })
        const merged   = [...updated, ...appendItems]
        const newTotal = merged.reduce((s, li) => s + li.lineTotal, 0)
        setOpenPOs((prev) =>
            prev.map((p) => p.id === poId ? { ...p, items: merged, totalCost: newTotal } : p),
        )

        if (dealershipId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = { total_cost: newTotal }
            if (newEta) payload.eta = newEta
            await supabase.from('purchase_orders').update(payload).eq('id', poId)
            for (const r of replaceItems) {
                await supabase.from('po_line_items')
                    .update({ order_qty: r.orderQty, line_total: r.lineTotal })
                    .eq('po_id', poId).eq('inventory_id', r.inventoryId)
            }
            if (appendItems.length > 0) {
                await supabase.from('po_line_items').insert(
                    appendItems.map((li) => ({
                        po_id:          poId,
                        inventory_id:   li.inventoryId,
                        name:           li.name,
                        article_number: li.articleNumber,
                        order_qty:      li.orderQty,
                        unit_cost:      li.unitCost,
                        line_total:     li.lineTotal,
                        size:           li.size ?? null,
                    })),
                )
            }
        }
    }

    // ── Mark a PO as placed on the supplier portal ─────────────────────────────

    async function handleMarkAsOrdered(poId: string, orderRef: string) {
        const dealershipId = getDealershipId()
        const placedAt     = new Date().toISOString()
        setOpenPOs((prev) =>
            prev.map((p) =>
                p.id === poId
                    ? { ...p, status: 'Sent', supplierOrderRef: orderRef || undefined, placedAt }
                    : p,
            ),
        )
        setOrderingVendor(null)
        setPortalOrderRef('')
        if (dealershipId) {
            await supabase
                .from('purchase_orders')
                .update({ status: 'Sent', supplier_order_ref: orderRef || null, placed_at: placedAt })
                .eq('id', poId)
        }
    }

    // ── Directly add uncovered items to an existing Draft PO ──────────────────

    async function handleDirectAddToExisting(
        poId: string,
        uncoveredItems: Array<{ item: FlatInventoryItem; qty: number }>,
    ) {
        const lineItems: POLineItem[] = uncoveredItems.map(({ item, qty }) => ({
            inventoryId:   item.id,
            name:          item.name,
            articleNumber: item.articleNumber,
            orderQty:      qty,
            unitCost:      item.cost,
            lineTotal:     qty * item.cost,
            ...(item.size ? { size: item.size } : {}),
        }))
        await handleAddToExistingPO(poId, lineItems)
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 flex-1 h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
            <div className="brand-top-bar" />

            {/* Compact header — matches other inventory pages */}
            <div className="px-5 md:px-8 py-2.5 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="text-lg">🏍</span>
                        <h1 className="text-base font-bold text-slate-900">Inventory</h1>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold hidden sm:inline">· Lager</span>
                    </div>
                    {lowStockAlerts.length > 0 && (
                        <span className="flex items-center gap-1 text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full">
                            ⚠ {lowStockAlerts.length} Low Stock
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 px-5 md:px-8 py-3 flex flex-col gap-3 overflow-y-auto">

                {/* Sub-nav tabs + supplier filter */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg w-fit">
                        {NAV_TABS.map((tab) => {
                            const count = tab.id === 'motorcycles' ? motorcycles.length
                                : tab.id === 'spareParts'  ? spareParts.length
                                : tab.id === 'accessories' ? accessories.length
                                : lowStockAlerts.length
                            const isActive = tab.id === 'lowStock'
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                        isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                        isActive                           ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]'
                                        : tab.id === 'lowStock' && count > 0 ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-200 text-slate-500'
                                    }`}>{count}</span>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Supplier filter */}
                    <select
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg bg-white px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#FF6B2C]/40"
                    >
                        <option value="">All suppliers</option>
                        {allSuppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {supplierFilter && (
                        <button
                            onClick={() => setSupplierFilter('')}
                            className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                            clear
                        </button>
                    )}
                </div>

                {/* Page description */}
                <div className="shrink-0">
                    <h2 className="text-base font-bold text-slate-800">Low Stock — by Supplier</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        All low-stock items from the same supplier are grouped together under one PO and one Ref No.
                    </p>
                </div>

                {/* Real-world lifecycle callout */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-2 text-xs text-blue-700 shrink-0">
                    <span className="font-bold shrink-0 mt-px">ℹ</span>
                    <div className="space-y-1">
                        <p>
                            <strong>Alerts stay until stock is replenished.</strong> Creating a PO means &ldquo;ordered,
                            waiting for delivery&rdquo; — the alert remains visible so you know stock hasn&apos;t arrived yet.
                            It disappears automatically once you mark the PO as <strong>Received</strong> and stock updates.
                        </p>
                        <p className="text-blue-500">
                            Workflow: Low stock → Create PO → Enter{' '}
                            <span className="font-mono font-semibold">REF-…</span> on supplier portal → PO status
                            updates Draft → Reviewed → Sent → <strong>Received</strong> → alert gone.
                        </p>
                    </div>
                </div>

                {/* Main content */}
                {lowStockAlerts.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-10 flex flex-col items-center gap-3 text-center">
                        <span className="text-4xl">✅</span>
                        <p className="text-sm font-semibold text-green-800">All items are above reorder level</p>
                        <p className="text-xs text-green-600">Nothing to order right now.</p>
                    </div>
                ) : visibleGroups.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-8 flex flex-col items-center gap-2 text-center text-slate-400">
                        <span className="text-2xl">🔍</span>
                        <p className="text-sm">No low stock items for <strong>{supplierFilter}</strong></p>
                        <button onClick={() => setSupplierFilter('')} className="text-xs underline mt-1">
                            Show all suppliers
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3 pb-6">
                        {visibleGroups.map((group) => {
                            // inventoryIds actually present in open PO line items for this vendor
                            const coveredInventoryIds = new Set<string>(
                                openPOs
                                    .filter((p) => p.vendor === group.vendor)
                                    .flatMap((p) => p.items.map((li) => li.inventoryId))
                            )

                            // Most recent open PO for this vendor (for header display)
                            const existingOpenPO = openPOs
                                .filter((p) => p.vendor === group.vendor)
                                .sort((a, b) => b.id.localeCompare(a.id))[0] ?? null

                            const uncoveredAlerts = group.alerts.filter((a) => !coveredInventoryIds.has(a.inventoryId))
                            const uncoveredItems  = group.items.filter(({ item }) => !coveredInventoryIds.has(item.id))

                            const allCovered  = group.alerts.length > 0 && uncoveredAlerts.length === 0
                            const someCovered = !allCovered && coveredInventoryIds.size > 0
                            const hasPO       = !!existingOpenPO

                            // POs in Draft/Reviewed can still be "marked as ordered on portal"
                            const canMarkOrdered = hasPO &&
                                (existingOpenPO!.status === 'Draft' || existingOpenPO!.status === 'Reviewed')

                            // When an existing Draft PO is open, add new items directly into it instead of new PO
                            const existingDraftPO = openPOs
                                .filter((p) => p.vendor === group.vendor && p.status === 'Draft')
                                .sort((a, b) => b.id.localeCompare(a.id))[0] ?? null

                            const statusColor = existingOpenPO?.status === 'Sent'
                                ? 'bg-purple-100 text-purple-700'
                                : existingOpenPO?.status === 'Reviewed'
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-slate-100 text-slate-600'

                            const vendorEmail = vendorEmails[group.vendor]
                            const isOrderingThis = orderingVendor === group.vendor

                            return (
                                <div
                                    key={group.vendor}
                                    className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${
                                        hasPO ? 'border-l-blue-400 border border-blue-100' : 'border-l-amber-400 border border-slate-200'
                                    }`}
                                >
                                    {/* ── Supplier header ── */}
                                    <div className={`px-4 py-3 border-b ${
                                        hasPO ? 'bg-blue-50/40 border-blue-100' : 'bg-slate-50 border-slate-100'
                                    }`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-base shrink-0">🏭</span>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-bold text-slate-800 truncate">
                                                            {group.vendor}
                                                        </p>
                                                        {allCovered && (
                                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide">
                                                                Order in progress
                                                            </span>
                                                        )}
                                                        {someCovered && (
                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide">
                                                                Partially ordered
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Vendor contact */}
                                                    {vendorEmail && (
                                                        <a
                                                            href={`mailto:${vendorEmail}`}
                                                            className="text-[11px] text-blue-500 hover:text-blue-700 mt-0.5 inline-flex items-center gap-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            📧 {vendorEmail}
                                                        </a>
                                                    )}

                                                    {hasPO ? (
                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                            <span className="font-mono text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                                                {existingOpenPO!.id}
                                                            </span>
                                                            <span className="text-slate-400 text-[11px]">→</span>
                                                            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                                                {existingOpenPO!.refNo ?? poIdToRefNo(existingOpenPO!.id)}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                                                                {existingOpenPO!.status}
                                                            </span>
                                                            {existingOpenPO!.supplierOrderRef && (
                                                                <span className="text-[10px] font-mono text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                                                                    Portal: {existingOpenPO!.supplierOrderRef}
                                                                </span>
                                                            )}
                                                            {existingOpenPO!.placedAt && (
                                                                <span className="text-[10px] text-slate-400 italic hidden sm:inline">
                                                                    · placed {new Date(existingOpenPO!.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                            {!existingOpenPO!.placedAt && (
                                                                <span className="text-[10px] text-slate-400 italic hidden sm:inline">
                                                                    · use Ref No. on supplier portal
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {group.alerts.length} item{group.alerts.length !== 1 ? 's' : ''} below reorder level
                                                            {' · '}
                                                            <span className="font-semibold text-slate-500">all go into one PO</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ── Action buttons ── */}
                                            <div className="shrink-0 ml-2 flex flex-col items-end gap-1.5">
                                                {/* Order / add items button */}
                                                {allCovered ? null
                                                : someCovered ? (
                                                    uncoveredItems.length > 0 && (
                                                        existingDraftPO ? (
                                                            // Add new items directly into the existing Draft PO — no new PO needed
                                                            <button
                                                                onClick={() => handleDirectAddToExisting(existingDraftPO.id, uncoveredItems)}
                                                                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                            >
                                                                ＋ Add {uncoveredItems.length} item{uncoveredItems.length !== 1 ? 's' : ''} to {existingDraftPO.id}
                                                            </button>
                                                        ) : (
                                                            // Existing PO is Sent/Reviewed — must create a new PO
                                                            <button
                                                                onClick={() => setModalConfig({ vendor: group.vendor, items: uncoveredItems })}
                                                                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                            >
                                                                + New PO · {uncoveredItems.length} item{uncoveredItems.length !== 1 ? 's' : ''}
                                                            </button>
                                                        )
                                                    )
                                                ) : (
                                                    // No PO yet — create one for ALL low-stock items
                                                    group.items.length > 0 ? (
                                                        <button
                                                            onClick={() => setModalConfig({ vendor: group.vendor, items: group.items })}
                                                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                        >
                                                            + Create PO · {group.alerts.length} item{group.alerts.length !== 1 ? 's' : ''}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Loading…</span>
                                                    )
                                                )}

                                                {/* Mark as Ordered — only for Draft/Reviewed POs not yet placed */}
                                                {canMarkOrdered && !existingOpenPO!.placedAt && (
                                                    <button
                                                        onClick={() => {
                                                            setOrderingVendor(isOrderingThis ? null : group.vendor)
                                                            setPortalOrderRef('')
                                                        }}
                                                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                                                            isOrderingThis
                                                                ? 'bg-slate-200 text-slate-600'
                                                                : 'bg-green-500 hover:bg-green-600 text-white'
                                                        }`}
                                                    >
                                                        {isOrderingThis ? '✕ Cancel' : '✓ Placed on Portal'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── "Mark as Ordered" inline form ── */}
                                        {isOrderingThis && existingOpenPO && (
                                            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-green-800 mb-1">
                                                        Confirm order placed on supplier portal
                                                    </p>
                                                    <input
                                                        type="text"
                                                        placeholder="Supplier's portal order / confirmation number (optional)"
                                                        value={portalOrderRef}
                                                        onChange={(e) => setPortalOrderRef(e.target.value)}
                                                        className="w-full text-xs border border-green-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-400 placeholder-slate-300"
                                                        autoFocus
                                                    />
                                                    <p className="text-[10px] text-green-600 mt-1 italic">
                                                        This marks the PO as <strong>Sent</strong> and records when the order was placed.
                                                        Use Ref No. <span className="font-mono font-bold">{existingOpenPO.refNo ?? poIdToRefNo(existingOpenPO.id)}</span> on the supplier portal.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleMarkAsOrdered(existingOpenPO.id, portalOrderRef)}
                                                    className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                                                >
                                                    ✓ Confirm Order Placed
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Items table ── */}
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-left text-[10px] uppercase text-slate-400 tracking-wider">
                                                <th className="px-4 py-2 w-8" />
                                                <th className="px-4 py-2">Item</th>
                                                <th className="px-4 py-2 hidden md:table-cell">Article No.</th>
                                                <th className="px-4 py-2 text-center">Stock</th>
                                                <th className="px-4 py-2 text-center">Reorder Qty</th>
                                                <th className="px-4 py-2 hidden sm:table-cell">Location</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {group.alerts.map((alert) => {
                                                const inPO = coveredInventoryIds.has(alert.inventoryId)
                                                return (
                                                    <tr key={alert.inventoryId} className={`hover:bg-slate-50/60 transition-colors ${inPO ? 'opacity-60' : ''}`}>
                                                        <td className="px-4 py-2.5 text-center text-sm">
                                                            <span title={alert.itemType}>
                                                                {ITEM_TYPE_ICON[alert.itemType]}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-medium text-slate-800">{alert.name}</p>
                                                                {inPO && (
                                                                    <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                                        In PO
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-slate-400">{alert.brand}</p>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-slate-500 hidden md:table-cell">
                                                            {alert.articleNumber}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="text-red-600 font-bold">{alert.currentStock}</span>
                                                            <span className="text-slate-400 ml-1">left</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center text-slate-500">
                                                            {alert.reorderQty}
                                                        </td>
                                                        <td className="px-4 py-2.5 hidden sm:table-cell">
                                                            {alert.location ? (
                                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                                                    {alert.location}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create PO Modal — vendor locked, pre-filled with uncovered items */}
            {modalConfig && (
                <CreatePOModal
                    nextPOId={nextPOId}
                    allInventoryItems={allInventoryItems}
                    suppliers={dealerSuppliers}
                    openPOs={openPOs}
                    onSave={handleSavePO}
                    onAddToExisting={handleAddToExistingPO}
                    onClose={() => setModalConfig(null)}
                    defaultVendor={modalConfig.vendor}
                    defaultItems={modalConfig.items}
                />
            )}
        </div>
        </div>
    )
}
