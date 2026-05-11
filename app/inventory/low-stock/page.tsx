'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useInventory } from '@/context/InventoryContext'
import { supabase } from '@/lib/supabase'
import { getDealershipId, getDealershipTag } from '@/lib/tenant'
import { CreatePOModal, FlatInventoryItem } from '@/components/CreatePOModal'
import { POLineItem, POLineItemStatus, POStatus, PurchaseOrder, LowStockAlert, POPlacementOutcome } from '@/utils/types'
import Sidebar from '@/components/Sidebar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function poIdToRefNo(poId: string): string {
    return poId.replace(/^PO-/, 'REF-')
}

function businessDaysSince(isoDate: string): number {
    const start = new Date(isoDate)
    const now   = new Date()
    let days = 0
    const cur = new Date(start)
    while (cur < now) {
        cur.setDate(cur.getDate() + 1)
        const dow = cur.getDay()
        if (dow !== 0 && dow !== 6) days++
    }
    return days
}

function timeAgo(isoDate: string): string {
    const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
    if (days < 1)   return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30)  return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}yr ago`
}

const PLACEMENT_OUTCOME_LABEL: Record<POPlacementOutcome, { label: string; color: string }> = {
    confirmed:      { label: 'All confirmed',    color: 'bg-green-100 text-green-700'  },
    backordered:    { label: 'Items backordered', color: 'bg-amber-100 text-amber-700' },
    credit_blocked: { label: 'Credit hold',       color: 'bg-red-100 text-red-700'     },
    substituted:    { label: 'Items substituted', color: 'bg-blue-100 text-blue-700'   },
}

const LINE_ITEM_STATUS_STYLE: Record<POLineItemStatus, { label: string; color: string }> = {
    pending:     { label: 'Pending',     color: 'bg-slate-100 text-slate-600'  },
    confirmed:   { label: 'Confirmed',   color: 'bg-green-100 text-green-700'  },
    backordered: { label: 'Backordered', color: 'bg-amber-100 text-amber-700'  },
    received:    { label: 'Received',    color: 'bg-blue-100 text-blue-700'    },
    damaged:     { label: 'Damaged',     color: 'bg-red-100 text-red-700'      },
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

interface POCard {
    kind: 'po'
    po: PurchaseOrder
    vendor: string
    coveredAlerts: LowStockAlert[]
    coveredItems: Array<{ item: FlatInventoryItem; qty: number }>
}

interface UncoveredCard {
    kind: 'uncovered'
    vendor: string
    alerts: LowStockAlert[]
    items: Array<{ item: FlatInventoryItem; qty: number }>
}

type DisplayCard = POCard | UncoveredCard

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

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
    const [vendorMOQs,      setVendorMOQs]      = useState<Record<string, number>>({})
    const [openPOs,         setOpenPOs]         = useState<PurchaseOrder[]>([])
    const [supplierFilter,  setSupplierFilter]  = useState('')

    const [lastOrderedMap,  setLastOrderedMap]  = useState<Record<string, { date: string; qty: number; poId: string }>>({})

    const [alertFirstSeenMap, setAlertFirstSeenMap] = useState<Record<string, string>>({})
    const [escalationDays,    setEscalationDays]    = useState<number>(7)

    // "Mark as Ordered" inline form — keyed by PO ID
    const [orderingPoId,       setOrderingPoId]       = useState<string | null>(null)
    const [portalOrderRef,     setPortalOrderRef]     = useState('')
    const [portalOutcome,      setPortalOutcome]      = useState<POPlacementOutcome>('confirmed')
    const [portalNotes,        setPortalNotes]        = useState('')
    const [backorderedItemIds, setBackorderedItemIds] = useState<Set<string>>(new Set())
    const [backorderedETA,     setBackorderedETA]     = useState('')

    const [modalConfig, setModalConfig] = useState<{
        vendor: string
        items:  Array<{ item: FlatInventoryItem; qty: number }>
    } | null>(null)

    const [selectedAlert, setSelectedAlert] = useState<{
        alert:    LowStockAlert
        po:       PurchaseOrder | null
        lineItem: POLineItem | null
    } | null>(null)

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
            .select('name, email, moq')
            .eq('dealership_id', id)
            .eq('is_manual', true)
            .order('name')
            .then(({ data }) => {
                if (data) {
                    setDealerSuppliers(data.map((r) => r.name))
                    const emailMap: Record<string, string> = {}
                    const moqMap:   Record<string, number> = {}
                    data.forEach((r) => {
                        if (r.email) emailMap[r.name] = r.email
                        if (r.moq)   moqMap[r.name]   = r.moq
                    })
                    setVendorEmails(emailMap)
                    setVendorMOQs(moqMap)
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
                placementOutcome: po.placement_outcome ?? undefined,
                placementNotes:   po.placement_notes ?? undefined,
                approvalStatus:   po.approval_status ?? undefined,
                items: (items ?? [])
                    .filter((li) => li.po_id === po.id)
                    .map((li) => ({
                        inventoryId:   li.inventory_id,
                        name:          li.name,
                        articleNumber: li.article_number,
                        orderQty:      li.order_qty,
                        unitCost:      Number(li.unit_cost),
                        lineTotal:     Number(li.line_total),
                        ...(li.size             ? { size: li.size }                              : {}),
                        ...(li.status           ? { status: li.status as POLineItemStatus }      : {}),
                        ...(li.received_qty != null ? { receivedQty: li.received_qty }           : {}),
                        ...(li.damaged_qty  != null ? { damagedQty:  li.damaged_qty  }           : {}),
                        ...(li.backordered_eta  ? { backorderedETA: li.backordered_eta }         : {}),
                        ...(li.line_notes       ? { lineNotes: li.line_notes }                   : {}),
                    })),
            }))
            setOpenPOs(mapped)
        }

        async function loadReceivedHistory() {
            const { data: receivedOrders } = await supabase
                .from('purchase_orders')
                .select('id, date')
                .eq('dealership_id', id!)
                .eq('status', 'Received')
                .order('date', { ascending: false })
            if (!receivedOrders || receivedOrders.length === 0) return
            const poIds = receivedOrders.map((o) => o.id)
            const { data: lineItems } = await supabase
                .from('po_line_items')
                .select('po_id, inventory_id, order_qty')
                .in('po_id', poIds)
            if (!lineItems) return
            const dateById: Record<string, string> = {}
            receivedOrders.forEach((o) => { dateById[o.id] = o.date })
            const map: Record<string, { date: string; qty: number; poId: string }> = {}
            for (const li of lineItems) {
                const date = dateById[li.po_id]
                if (!date || !li.inventory_id) continue
                const existing = map[li.inventory_id]
                if (!existing || date > existing.date) {
                    map[li.inventory_id] = { date, qty: li.order_qty, poId: li.po_id }
                }
            }
            setLastOrderedMap(map)
        }

        async function loadEscalationDays() {
            const { data } = await supabase
                .from('dealership_settings')
                .select('low_stock_escalation_days')
                .eq('dealership_id', id!)
                .single()
            if (data?.low_stock_escalation_days) setEscalationDays(Number(data.low_stock_escalation_days))
        }

        async function loadAlertLog() {
            const { data } = await supabase
                .from('low_stock_alerts_log')
                .select('inventory_id, first_seen_at')
                .eq('dealership_id', id!)
            if (data) {
                const map: Record<string, string> = {}
                data.forEach((r) => { map[r.inventory_id] = r.first_seen_at })
                setAlertFirstSeenMap(map)
            }
        }

        loadOpenPOs()
        loadReceivedHistory()
        loadEscalationDays()
        loadAlertLog()
    }, [])

    useEffect(() => {
        const dealershipId = getDealershipId()
        if (!dealershipId || lowStockAlerts.length === 0) return
        const now = new Date().toISOString()
        supabase
            .from('low_stock_alerts_log')
            .upsert(
                lowStockAlerts.map((a) => ({
                    inventory_id:  a.inventoryId,
                    dealership_id: dealershipId,
                    first_seen_at: now,
                })),
                { onConflict: 'inventory_id,dealership_id', ignoreDuplicates: true },
            )
            .then(({ error }) => {
                if (error) console.error('[Low Stock] Alert log upsert failed:', error.message)
            })
    }, [lowStockAlerts])

    const allInventoryItems = useMemo<FlatInventoryItem[]>(() => [
        ...motorcycles.map((m) => ({ id: m.id, name: m.name, articleNumber: m.articleNumber, vendor: m.vendor, cost: m.cost })),
        ...spareParts.map((s)  => ({ id: s.id, name: s.name, articleNumber: s.articleNumber, vendor: s.vendor, cost: s.cost })),
        ...accessories.map((a) => ({ id: a.id, name: a.name, articleNumber: a.articleNumber, vendor: a.vendor, cost: a.cost, size: a.size })),
    ], [motorcycles, spareParts, accessories])

    // ── One card per open PO (with its covered alerts) + one uncovered card per vendor ──
    const displayCards = useMemo<DisplayCard[]>(() => {
        // Build set of inventoryIds covered by any open PO
        const coveredIds = new Set<string>()
        for (const po of openPOs) {
            for (const li of po.items) coveredIds.add(li.inventoryId)
        }

        // PO cards — one per open PO that covers at least one low-stock alert
        const poCards: POCard[] = openPOs
            .map((po) => {
                const coveredAlerts = lowStockAlerts.filter((a) =>
                    po.items.some((li) => li.inventoryId === a.inventoryId)
                )
                if (coveredAlerts.length === 0) return null
                const coveredItems = coveredAlerts
                    .map((a) => {
                        const item = allInventoryItems.find((i) => i.id === a.inventoryId)
                        return item ? { item, qty: a.reorderQty } : null
                    })
                    .filter((x): x is { item: FlatInventoryItem; qty: number } => x !== null)
                return { kind: 'po' as const, po, vendor: po.vendor, coveredAlerts, coveredItems }
            })
            .filter((c): c is POCard => c !== null)

        // Uncovered cards — alerts not in any open PO, grouped by vendor
        const uncoveredAlerts = lowStockAlerts.filter((a) => !coveredIds.has(a.inventoryId))
        const byVendor = new Map<string, LowStockAlert[]>()
        for (const alert of uncoveredAlerts) {
            if (!byVendor.has(alert.vendor)) byVendor.set(alert.vendor, [])
            byVendor.get(alert.vendor)!.push(alert)
        }
        const uncoveredCards: UncoveredCard[] = [...byVendor.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([vendor, alerts]) => ({
                kind: 'uncovered' as const,
                vendor,
                alerts,
                items: alerts
                    .map((a) => {
                        const item = allInventoryItems.find((i) => i.id === a.inventoryId)
                        return item ? { item, qty: a.reorderQty } : null
                    })
                    .filter((x): x is { item: FlatInventoryItem; qty: number } => x !== null),
            }))

        // Uncovered cards first (need action), then PO cards newest-first
        return [
            ...uncoveredCards,
            ...poCards.sort((a, b) => b.po.id.localeCompare(a.po.id)),
        ]
    }, [lowStockAlerts, openPOs, allInventoryItems])

    const allSuppliers = useMemo(
        () => [...new Set([...lowStockAlerts.map((a) => a.vendor), ...dealerSuppliers])].sort(),
        [lowStockAlerts, dealerSuppliers],
    )
    void allSuppliers

    const visibleCards = supplierFilter.trim()
        ? displayCards.filter((c) => c.vendor.toLowerCase().includes(supplierFilter.trim().toLowerCase()))
        : displayCards

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

    async function handleMarkAsOrdered(
        poId: string,
        orderRef: string,
        outcome: POPlacementOutcome,
        notes: string,
        lineStatuses: Array<{ inventoryId: string; size?: string; status: POLineItemStatus; backorderedETA?: string }>,
    ) {
        const dealershipId = getDealershipId()
        const placedAt     = new Date().toISOString()
        setOpenPOs((prev) =>
            prev.map((p) =>
                p.id === poId
                    ? { ...p, status: 'Sent', supplierOrderRef: orderRef || undefined, placedAt, placementOutcome: outcome, placementNotes: notes || undefined }
                    : p,
            ),
        )
        setOrderingPoId(null)
        setPortalOrderRef('')
        setPortalOutcome('confirmed')
        setPortalNotes('')
        if (dealershipId) {
            const { error } = await supabase
                .from('purchase_orders')
                .update({
                    status:             'Sent',
                    supplier_order_ref: orderRef || null,
                    placed_at:          placedAt,
                    placement_outcome:  outcome,
                    placement_notes:    notes || null,
                })
                .eq('id', poId)
            if (error) console.error('[Low Stock] Mark ordered update failed:', error.message, error.details)
            for (const ls of lineStatuses) {
                const q = supabase
                    .from('po_line_items')
                    .update({ status: ls.status, backordered_eta: ls.backorderedETA ?? null })
                    .eq('po_id', poId)
                    .eq('inventory_id', ls.inventoryId)
                const { error: liErr } = await (ls.size ? q.eq('size', ls.size) : q.is('size', null))
                if (liErr) console.error('[Low Stock] Line status update failed:', liErr.message)
            }
        }
    }

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

    // ── Shared items table ────────────────────────────────────────────────────

    function ItemsTable({
        alerts,
        vendorMOQ,
        po,
        onRowClick,
    }: {
        alerts: LowStockAlert[]
        vendorMOQ?: number
        po: PurchaseOrder | null
        onRowClick: (alert: LowStockAlert) => void
    }) {
        return (
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] uppercase text-slate-400 tracking-wider">
                        <th className="px-4 py-2 w-8" />
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2 hidden md:table-cell">Article No.</th>
                        <th className="px-4 py-2 text-center">Stock</th>
                        <th className="px-4 py-2 text-center">
                            Reorder Qty
                            {vendorMOQ && (
                                <span className="ml-1 text-[9px] text-slate-400 normal-case tracking-normal">(MOQ {vendorMOQ})</span>
                            )}
                        </th>
                        <th className="px-4 py-2 hidden lg:table-cell">Last Ordered</th>
                        <th className="px-4 py-2 hidden sm:table-cell">Location</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {alerts.map((alert) => {
                        const lastOrder = lastOrderedMap[alert.inventoryId]
                        const moqShort  = vendorMOQ ? alert.reorderQty < vendorMOQ : false
                        const lineItem  = po?.items.find((li) => li.inventoryId === alert.inventoryId)
                        return (
                            <tr
                                key={alert.inventoryId}
                                className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                                onClick={() => onRowClick(alert)}
                            >
                                <td className="px-4 py-2.5 text-center text-sm">
                                    <span title={alert.itemType}>{ITEM_TYPE_ICON[alert.itemType]}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-slate-800">{alert.name}</p>
                                        {lineItem?.status && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${LINE_ITEM_STATUS_STYLE[lineItem.status].color}`}>
                                                {LINE_ITEM_STATUS_STYLE[lineItem.status].label}
                                            </span>
                                        )}
                                        {moqShort && (
                                            <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-wide" title="Reorder qty below supplier MOQ">
                                                Below MOQ
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
                                <td className="px-4 py-2.5 text-center">
                                    <span className={moqShort ? 'text-red-600 font-bold' : 'text-slate-500'}>
                                        {alert.reorderQty}
                                    </span>
                                    {moqShort && vendorMOQ && (
                                        <span className="block text-[9px] text-red-400">min {vendorMOQ}</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5 hidden lg:table-cell">
                                    {lastOrder ? (
                                        <div>
                                            <span className="text-slate-600 font-medium">{timeAgo(lastOrder.date)}</span>
                                            <span className="text-slate-400 ml-1">· ×{lastOrder.qty}</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 italic text-[10px]">No history</span>
                                    )}
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
        )
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 flex-1 h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
            <div className="brand-top-bar" />

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

                    <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-slate-400 text-xs pointer-events-none">🔍</span>
                        <input
                            type="text"
                            placeholder="Filter by supplier…"
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="pl-7 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF6B2C]/40 w-44"
                        />
                        {supplierFilter && (
                            <button
                                onClick={() => setSupplierFilter('')}
                                className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                title="Clear filter"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {supplierFilter.trim() && (
                        <span className="text-xs text-slate-500">
                            {visibleCards.length} result{visibleCards.length !== 1 ? 's' : ''} found
                        </span>
                    )}
                </div>

                <div className="shrink-0">
                    <h2 className="text-base font-bold text-slate-800">Low Stock — by PO</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Each open PO is its own card. Items not yet in any PO are grouped by supplier.
                    </p>
                </div>

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
                ) : visibleCards.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-8 flex flex-col items-center gap-2 text-center text-slate-400">
                        <span className="text-2xl">🔍</span>
                        <p className="text-sm">No results for <strong>{supplierFilter}</strong></p>
                        <button onClick={() => setSupplierFilter('')} className="text-xs underline mt-1">
                            Show all
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3 pb-6">
                        {visibleCards.map((card) => {
                            const vendor    = card.vendor
                            const vendorMOQ = vendorMOQs[vendor]
                            const vendorEmail = vendorEmails[vendor]

                            /* ── Uncovered card (no PO yet) ─────────────────── */
                            if (card.kind === 'uncovered') {
                                const oldestFirstSeen = card.alerts.reduce<string | null>((oldest, a) => {
                                    const s = alertFirstSeenMap[a.inventoryId]
                                    return s ? (!oldest || s < oldest ? s : oldest) : oldest
                                }, null)
                                const isEscalated   = oldestFirstSeen !== null && businessDaysSince(oldestFirstSeen) >= escalationDays
                                const escalatedDays = oldestFirstSeen ? businessDaysSince(oldestFirstSeen) : 0
                                // Existing Draft/Reviewed PO for this vendor (to offer direct add)
                                const existingDraftPO = openPOs.find(
                                    (p) => p.vendor === vendor && (p.status === 'Draft' || p.status === 'Reviewed')
                                ) ?? null

                                return (
                                    <div key={`uncovered-${vendor}`} className="bg-white rounded-xl shadow-sm overflow-hidden border-l-4 border-l-amber-400 border border-slate-200">
                                        <div className="px-4 py-3 border-b bg-amber-50/30 border-amber-100">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-base shrink-0">🏭</span>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-bold text-slate-800 truncate">{vendor}</p>
                                                            {isEscalated && (
                                                                <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide animate-pulse">
                                                                    🔺 Escalated — {escalatedDays}d unactioned
                                                                </span>
                                                            )}
                                                        </div>
                                                        {vendorEmail && (
                                                            <a href={`mailto:${vendorEmail}`} className="text-[11px] text-blue-500 hover:text-blue-700 mt-0.5 inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                📧 {vendorEmail}
                                                            </a>
                                                        )}
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {card.alerts.length} item{card.alerts.length !== 1 ? 's' : ''} below reorder level
                                                            {' · '}
                                                            <span className="font-semibold text-amber-600">no PO yet</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 ml-2 flex flex-col items-end gap-1.5">
                                                    {existingDraftPO && card.items.length > 0 ? (
                                                        <button
                                                            onClick={() => handleDirectAddToExisting(existingDraftPO.id, card.items)}
                                                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                        >
                                                            ＋ Add {card.alerts.length} item{card.alerts.length !== 1 ? 's' : ''} to {existingDraftPO.id}
                                                        </button>
                                                    ) : card.items.length > 0 ? (
                                                        <button
                                                            onClick={() => setModalConfig({ vendor, items: card.items })}
                                                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                        >
                                                            + Create PO · {card.alerts.length} item{card.alerts.length !== 1 ? 's' : ''}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Loading…</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <ItemsTable
                                            alerts={card.alerts}
                                            vendorMOQ={vendorMOQ}
                                            po={null}
                                            onRowClick={(alert) => setSelectedAlert({ alert, po: null, lineItem: null })}
                                        />
                                    </div>
                                )
                            }

                            /* ── PO card ──────────────────────────────────────── */
                            const { po }         = card
                            const isOrdering     = orderingPoId === po.id
                            const canMarkOrdered = (po.status === 'Draft' || po.status === 'Reviewed') && !po.placedAt
                            const followUpNeeded = po.status === 'Sent' && !!po.placedAt && businessDaysSince(po.placedAt) >= 5
                            const daysWaiting    = po.placedAt ? businessDaysSince(po.placedAt) : 0
                            const poStatusColor  = po.status === 'Sent'
                                ? 'bg-purple-100 text-purple-700'
                                : po.status === 'Reviewed'
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-slate-100 text-slate-600'

                            return (
                                <div key={po.id} className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${
                                    po.status === 'Sent' ? 'border-l-purple-400 border border-purple-100' : 'border-l-blue-400 border border-blue-100'
                                }`}>
                                    <div className={`px-4 py-3 border-b ${po.status === 'Sent' ? 'bg-purple-50/30 border-purple-100' : 'bg-blue-50/40 border-blue-100'}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-base shrink-0">📋</span>
                                                <div className="min-w-0">
                                                    {/* PO ID + Ref No + status badges */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">{po.id}</span>
                                                        <span className="text-slate-400 text-xs">→</span>
                                                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                                            {po.refNo ?? poIdToRefNo(po.id)}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${poStatusColor}`}>
                                                            {po.status}
                                                        </span>
                                                        {followUpNeeded && (
                                                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                                                                ⚠ Follow up — {daysWaiting}d waiting
                                                            </span>
                                                        )}
                                                        {po.placementOutcome && (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${PLACEMENT_OUTCOME_LABEL[po.placementOutcome].color}`}>
                                                                {PLACEMENT_OUTCOME_LABEL[po.placementOutcome].label}
                                                            </span>
                                                        )}
                                                        {po.approvalStatus === 'pending_approval' && (
                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                                🔐 Pending approval
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Vendor name */}
                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        <span className="text-[11px] text-slate-400">🏭</span>
                                                        <span className="text-xs font-semibold text-slate-600">{vendor}</span>
                                                        {vendorEmail && (
                                                            <a href={`mailto:${vendorEmail}`} className="text-[11px] text-blue-500 hover:text-blue-700 inline-flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                                                                📧 {vendorEmail}
                                                            </a>
                                                        )}
                                                    </div>
                                                    {/* Portal ref + placed date */}
                                                    {(po.supplierOrderRef || po.placedAt) && (
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {po.supplierOrderRef && (
                                                                <span className="text-[10px] font-mono text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                                                                    Portal: {po.supplierOrderRef}
                                                                </span>
                                                            )}
                                                            {po.placedAt && (
                                                                <span className="text-[10px] text-slate-400 italic">
                                                                    placed {new Date(po.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!po.placedAt && (
                                                        <p className="text-[10px] text-slate-400 italic mt-0.5">
                                                            Use Ref No. on supplier portal to place order
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action button */}
                                            <div className="shrink-0 ml-2">
                                                {canMarkOrdered && (
                                                    <button
                                                        onClick={() => {
                                                            setOrderingPoId(isOrdering ? null : po.id)
                                                            setPortalOrderRef('')
                                                        }}
                                                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                                                            isOrdering
                                                                ? 'bg-slate-200 text-slate-600'
                                                                : 'bg-green-500 hover:bg-green-600 text-white'
                                                        }`}
                                                    >
                                                        {isOrdering ? '✕ Cancel' : '✓ Placed on Portal'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Inline "Placed on Portal" form ── */}
                                        {isOrdering && canMarkOrdered && (
                                            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-4 space-y-3">
                                                <p className="text-xs font-semibold text-green-800">
                                                    Confirm order placed on supplier portal
                                                    <span className="ml-1.5 font-normal text-green-700">
                                                        — Ref No. <span className="font-mono font-bold">{po.refNo ?? poIdToRefNo(po.id)}</span>
                                                    </span>
                                                </p>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {(['confirmed', 'backordered', 'credit_blocked', 'substituted'] as POPlacementOutcome[]).map((opt) => (
                                                        <label
                                                            key={opt}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition-colors ${
                                                                portalOutcome === opt
                                                                    ? 'bg-green-600 border-green-600 text-white'
                                                                    : 'bg-white border-green-200 text-slate-600 hover:border-green-400'
                                                            }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={`outcome-${po.id}`}
                                                                value={opt}
                                                                checked={portalOutcome === opt}
                                                                onChange={() => setPortalOutcome(opt)}
                                                                className="sr-only"
                                                            />
                                                            {PLACEMENT_OUTCOME_LABEL[opt].label}
                                                        </label>
                                                    ))}
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Supplier's portal order / confirmation number (optional)"
                                                        value={portalOrderRef}
                                                        onChange={(e) => setPortalOrderRef(e.target.value)}
                                                        className="flex-1 text-xs border border-green-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-400 placeholder-slate-300"
                                                        autoFocus
                                                    />
                                                </div>

                                                {portalOutcome === 'backordered' && (
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] uppercase tracking-wider text-green-700 font-semibold">
                                                            Select backordered items:
                                                        </p>
                                                        <div className="space-y-0.5 max-h-40 overflow-y-auto rounded-lg border border-green-200 bg-white px-2 py-1">
                                                            {po.items.map((li) => (
                                                                <label
                                                                    key={`${li.inventoryId}-${li.size ?? ''}`}
                                                                    className="flex items-start gap-2.5 px-1.5 py-2 rounded-md hover:bg-green-50 cursor-pointer"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={backorderedItemIds.has(`${li.inventoryId}|${li.size ?? ''}`)}
                                                                        onChange={(e) => {
                                                                            const key = `${li.inventoryId}|${li.size ?? ''}`
                                                                            setBackorderedItemIds((prev) => {
                                                                                const next = new Set(prev)
                                                                                if (e.target.checked) next.add(key)
                                                                                else next.delete(key)
                                                                                return next
                                                                            })
                                                                        }}
                                                                        className="w-3.5 h-3.5 accent-green-600 shrink-0 mt-0.5"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-xs font-semibold text-gray-800 leading-tight truncate">{li.name}</div>
                                                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                            <span className="font-mono text-[10px] text-gray-400">{li.articleNumber}</span>
                                                                            {li.size && (
                                                                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                                                                                    {li.size}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-gray-600 tabular-nums shrink-0 mt-0.5">×{li.orderQty}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-green-700 font-semibold uppercase tracking-wider whitespace-nowrap">New ETA:</span>
                                                            <input
                                                                type="date"
                                                                value={backorderedETA}
                                                                onChange={(e) => setBackorderedETA(e.target.value)}
                                                                className="text-xs border border-green-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                                                            />
                                                            <span className="text-[10px] text-gray-400 italic">optional</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {(portalOutcome === 'credit_blocked' || portalOutcome === 'substituted') && (
                                                    <textarea
                                                        placeholder={
                                                            portalOutcome === 'credit_blocked'
                                                                ? 'What did the supplier say? Credit limit / outstanding invoice?'
                                                                : 'Which items were substituted? New article numbers?'
                                                        }
                                                        value={portalNotes}
                                                        onChange={(e) => setPortalNotes(e.target.value)}
                                                        rows={2}
                                                        className="w-full text-xs border border-green-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-400 placeholder-slate-300 resize-none"
                                                    />
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            let compiledNotes = portalNotes
                                                            if (portalOutcome === 'backordered') {
                                                                const selected = po.items.filter((li) =>
                                                                    backorderedItemIds.has(`${li.inventoryId}|${li.size ?? ''}`)
                                                                )
                                                                const itemsText = selected.length > 0
                                                                    ? selected.map((li) => {
                                                                        const sizePart = li.size ? ` [${li.size}]` : ''
                                                                        return `${li.name}${sizePart} (${li.articleNumber}) ×${li.orderQty}`
                                                                    }).join(', ')
                                                                    : 'Items not specified'
                                                                compiledNotes = `Backordered: ${itemsText}${backorderedETA ? `. New ETA: ${backorderedETA}` : ''}`
                                                            }
                                                            const lineStatuses = po.items.map((li) => {
                                                                const key = `${li.inventoryId}|${li.size ?? ''}`
                                                                const isBO = portalOutcome === 'backordered' && backorderedItemIds.has(key)
                                                                return {
                                                                    inventoryId:   li.inventoryId,
                                                                    size:          li.size,
                                                                    status:        (isBO ? 'backordered' : portalOutcome === 'confirmed' ? 'confirmed' : 'pending') as POLineItemStatus,
                                                                    backorderedETA: isBO && backorderedETA ? backorderedETA : undefined,
                                                                }
                                                            })
                                                            handleMarkAsOrdered(po.id, portalOrderRef, portalOutcome, compiledNotes, lineStatuses)
                                                            setBackorderedItemIds(new Set())
                                                            setBackorderedETA('')
                                                        }}
                                                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                                                    >
                                                        ✓ Confirm Order Placed
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setOrderingPoId(null)
                                                            setPortalOrderRef('')
                                                            setPortalOutcome('confirmed')
                                                            setPortalNotes('')
                                                            setBackorderedItemIds(new Set())
                                                            setBackorderedETA('')
                                                        }}
                                                        className="bg-white border border-green-200 text-slate-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <ItemsTable
                                        alerts={card.coveredAlerts}
                                        vendorMOQ={vendorMOQ}
                                        po={po}
                                        onRowClick={(alert) => {
                                            const lineItem = po.items.find((li) => li.inventoryId === alert.inventoryId) ?? null
                                            setSelectedAlert({ alert, po, lineItem })
                                        }}
                                    />
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Line-item detail modal ────────────────────────────────────── */}
            {selectedAlert && (() => {
                const { alert, po, lineItem } = selectedAlert
                const lastOrder = lastOrderedMap[alert.inventoryId]
                const firstSeen = alertFirstSeenMap[alert.inventoryId]
                const daysInAlert = firstSeen ? Math.floor((Date.now() - new Date(firstSeen).getTime()) / 86_400_000) : null
                return (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => setSelectedAlert(null)}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-2xl shrink-0">{ITEM_TYPE_ICON[alert.itemType]}</span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 leading-tight">{alert.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{alert.brand}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedAlert(null)}
                                    className="shrink-0 text-slate-400 hover:text-slate-700 text-lg font-bold leading-none mt-0.5"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="px-5 py-4 space-y-4">

                                {/* Stock snapshot */}
                                <div className="bg-slate-50 rounded-xl px-4 py-3 grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">In Stock</p>
                                        <p className="text-lg font-bold text-red-600 mt-0.5">{alert.currentStock}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Reorder Qty</p>
                                        <p className="text-lg font-bold text-slate-700 mt-0.5">{alert.reorderQty}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Location</p>
                                        <p className="text-sm font-mono font-semibold text-slate-600 mt-1">
                                            {alert.location ?? <span className="text-slate-300 font-sans font-normal italic text-xs">—</span>}
                                        </p>
                                    </div>
                                </div>

                                {/* Article number row */}
                                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                    <span>
                                        <span className="text-slate-400 mr-1">Article:</span>
                                        <span className="font-mono font-semibold text-slate-700">{alert.articleNumber || '—'}</span>
                                    </span>
                                    <span className="text-slate-200">|</span>
                                    <span>
                                        <span className="text-slate-400 mr-1">Supplier:</span>
                                        <span className="font-semibold text-slate-700">{alert.vendor}</span>
                                    </span>
                                    {daysInAlert !== null && (
                                        <>
                                            <span className="text-slate-200">|</span>
                                            <span className={daysInAlert >= escalationDays ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                                                Low stock {daysInAlert === 0 ? 'since today' : `${daysInAlert}d`}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Last ordered */}
                                {lastOrder && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span className="text-slate-400">Last received:</span>
                                        <span className="font-semibold text-slate-700">{timeAgo(lastOrder.date)}</span>
                                        <span className="text-slate-400">· ×{lastOrder.qty}</span>
                                        <span className="font-mono text-[10px] text-slate-400">({lastOrder.poId})</span>
                                    </div>
                                )}

                                {/* Order status section */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Order Status</p>

                                    {!po ? (
                                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                            <span className="text-base">⚠</span>
                                            <div>
                                                <p className="text-xs font-semibold text-amber-800">Not yet ordered</p>
                                                <p className="text-[11px] text-amber-600 mt-0.5">No purchase order has been raised for this item.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            {/* PO identity row */}
                                            <div className={`px-4 py-3 flex items-center gap-2 flex-wrap border-b border-slate-100 ${
                                                po.status === 'Sent' ? 'bg-purple-50/40' : 'bg-blue-50/40'
                                            }`}>
                                                <span className="font-mono text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">{po.id}</span>
                                                <span className="text-slate-400 text-xs">→</span>
                                                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                                    {po.refNo ?? poIdToRefNo(po.id)}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    po.status === 'Sent'     ? 'bg-purple-100 text-purple-700'
                                                    : po.status === 'Reviewed' ? 'bg-teal-100 text-teal-700'
                                                    : 'bg-slate-100 text-slate-600'
                                                }`}>{po.status}</span>
                                                {lineItem?.status && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${LINE_ITEM_STATUS_STYLE[lineItem.status].color}`}>
                                                        Line: {LINE_ITEM_STATUS_STYLE[lineItem.status].label}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Detail rows */}
                                            <div className="divide-y divide-slate-50 text-xs">

                                                {/* Ordered qty */}
                                                {lineItem && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-slate-400">Qty ordered</span>
                                                        <span className="font-semibold text-slate-700">×{lineItem.orderQty}</span>
                                                    </div>
                                                )}

                                                {/* Placement outcome */}
                                                {po.placementOutcome && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                                                        <span className="text-slate-400">Portal outcome</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PLACEMENT_OUTCOME_LABEL[po.placementOutcome].color}`}>
                                                            {PLACEMENT_OUTCOME_LABEL[po.placementOutcome].label}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Placement notes (backordered items, credit block reason, substituted details) */}
                                                {po.placementNotes && (
                                                    <div className="px-4 py-2.5">
                                                        <p className="text-slate-400 mb-1">Notes from portal</p>
                                                        <p className="text-slate-700 leading-relaxed">{po.placementNotes}</p>
                                                    </div>
                                                )}

                                                {/* Backordered ETA on the line */}
                                                {lineItem?.backorderedETA && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-slate-400">Backordered ETA</span>
                                                        <span className="font-semibold text-amber-700">
                                                            {new Date(lineItem.backorderedETA).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Supplier order ref */}
                                                {po.supplierOrderRef && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-slate-400">Portal ref</span>
                                                        <span className="font-mono font-semibold text-green-700">{po.supplierOrderRef}</span>
                                                    </div>
                                                )}

                                                {/* Placed date */}
                                                {po.placedAt && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-slate-400">Placed on portal</span>
                                                        <span className="font-semibold text-slate-700">
                                                            {new Date(po.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Supplier confirmed */}
                                                {po.status === 'Sent' && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-slate-400">Supplier confirmed</span>
                                                        {po.supplierConfirmed ? (
                                                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                                ✓ Confirmed {po.confirmedAt ? timeAgo(po.confirmedAt) : ''}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                                                ⏳ Awaiting confirmation
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* PO ETA */}
                                                {po.eta && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-slate-400">Expected delivery</span>
                                                        <span className="font-semibold text-slate-700">
                                                            {new Date(po.eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Received / damaged */}
                                                {((lineItem?.receivedQty ?? 0) > 0 || (lineItem?.damagedQty ?? 0) > 0) && (
                                                    <div className="px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-slate-400">Received / Damaged</span>
                                                        <div className="flex items-center gap-2">
                                                            {(lineItem?.receivedQty ?? 0) > 0 && (
                                                                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                                    ✓ {lineItem!.receivedQty} received
                                                                </span>
                                                            )}
                                                            {(lineItem?.damagedQty ?? 0) > 0 && (
                                                                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                                                    ✕ {lineItem!.damagedQty} damaged
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Line notes */}
                                                {lineItem?.lineNotes && (
                                                    <div className="px-4 py-2.5">
                                                        <p className="text-slate-400 mb-1">Line notes</p>
                                                        <p className="text-slate-700 leading-relaxed">{lineItem.lineNotes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setSelectedAlert(null)}
                                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Create PO Modal */}
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
                    vendorMOQ={vendorMOQs[modalConfig.vendor]}
                />
            )}
        </div>
        </div>
    )
}
