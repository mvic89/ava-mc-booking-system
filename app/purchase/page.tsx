'use client'

import { useState, useMemo, useEffect } from 'react'
import { ReorderableTable, type ColDef } from '@/components/ResizableTable'
import { useInventory }   from '@/context/InventoryContext'
import { supabase }       from '@/lib/supabase'
import { getDealershipId, getDealershipTag } from '@/lib/tenant'
import { vendorDetails }  from '@/data/vendors'
import { POModal, STATUS_STYLE, formatCurrency, qtyKey, VendorItem } from '@/components/POModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
import { CreatePOModal, FlatInventoryItem } from '@/components/CreatePOModal'
import { ImportPOModal } from '@/components/ImportPOModal'
import { POLineItem, POLineItemStatus, POStatus, POApprovalStatus, POPlacementOutcome, PurchaseOrder, SupplierClaim } from '@/utils/types'
import Sidebar from '@/components/Sidebar'
import { Tip } from '@/components/Tip'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

const ALL_STATUSES: POStatus[] = ['Draft', 'Reviewed', 'Sent', 'Received']

const APPROVAL_BADGE: Record<POApprovalStatus, string> = {
    pending_approval: 'bg-amber-100 text-amber-700 border border-amber-300',
    approved:         'bg-green-100 text-green-700 border border-green-300',
    rejected:         'bg-red-100 text-red-700 border border-red-300',
}

// ─── PO number generator ──────────────────────────────────────────────────────
// Queries Supabase directly so the ID is always based on the true DB count,
// not just what happens to be loaded in the UI.

async function generateNextPOId(tag: string): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `PO-${tag}-${year}-`
    // No dealership_id filter — check ALL rows with this prefix so we never
    // collide with rows that have null dealership_id from old data.
    const { data } = await supabase
        .from('purchase_orders')
        .select('id')
        .like('id', `${prefix}%`)
        .order('id', { ascending: false })
        .limit(1)
    const lastNum = data?.[0]?.id
        ? parseInt(data[0].id.split('-').pop() ?? '0', 10)
        : 0
    return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ allPOs, filtered }: { allPOs: PurchaseOrder[]; filtered: PurchaseOrder[] }) {
    const t          = useTranslations('purchase')
    const totalValue = filtered.reduce((s, p) => s + p.totalCost, 0)
    const draft      = allPOs.filter((p) => p.status === 'Draft').length
    const sent       = allPOs.filter((p) => p.status === 'Sent').length

    const cards = [
        { label: t('summary.totalPos'),       value: String(allPOs.length),      icon: '📦', color: 'bg-blue-50 text-blue-700',     tip: t('summary.tips.totalPos') },
        { label: t('summary.draft'),          value: String(draft),              icon: '📝', color: 'bg-gray-100 text-gray-700',   tip: t('summary.tips.draft') },
        { label: t('summary.sent'),           value: String(sent),               icon: '📤', color: 'bg-orange-50 text-orange-700', tip: t('summary.tips.sent') },
        { label: t('summary.displayedValue'), value: formatCurrency(totalValue), icon: '💰', color: 'bg-green-50 text-green-700',   tip: t('summary.tips.displayedValue') },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {cards.map((c) => (
                <Tip key={c.label} text={c.tip}>
                    <div className={`rounded-xl p-4 cursor-default ${c.color}`}>
                        <div className="text-xl mb-1">{c.icon}</div>
                        <div className="text-xs font-medium opacity-70 mb-0.5">{c.label}</div>
                        <div className="text-lg font-bold">{c.value}</div>
                    </div>
                </Tip>
            ))}
        </div>
    )
}

// Each PO's Ref No is derived by swapping the "PO-" prefix for "REF-".
// This keeps them obviously paired: PO-AVA-2026-001 ↔ REF-AVA-2026-001.
function poIdToRefNo(poId: string): string {
    return poId.replace(/^PO-/, 'REF-')
}

// ─── Financial summary ────────────────────────────────────────────────────────

const OPEN_STATUSES = new Set(['Draft', 'Reviewed', 'Sent', 'Partial'])

function FinancialMetrics({ dealershipId, allPOs }: { dealershipId: string; allPOs: PurchaseOrder[] }) {
    const t = useTranslations('purchase')
    const [claimsValue, setClaimsValue] = useState(0)
    const [claimsCount, setClaimsCount] = useState(0)

    useEffect(() => {
        if (!dealershipId) return
        supabase
            .from('supplier_claims')
            .select('claimed_amount')
            .eq('dealership_id', dealershipId)
            .in('status', ['open', 'submitted'])
            .then(({ data }) => {
                if (!data) return
                setClaimsCount(data.length)
                setClaimsValue(data.reduce((s, r) => s + (Number(r.claimed_amount) || 0), 0))
            })
    }, [dealershipId])

    const thisMonthPrefix = new Date().toISOString().slice(0, 7) // "YYYY-MM"

    const openPOs    = allPOs.filter(p => OPEN_STATUSES.has(p.status))
    const monthlyPOs = allPOs.filter(p => p.status === 'Received' && p.date?.startsWith(thisMonthPrefix))

    const openPoValue    = openPOs.reduce((s, p) => s + p.totalCost, 0)
    const monthlySpend   = monthlyPOs.reduce((s, p) => s + p.totalCost, 0)

    const cards = [
        {
            label:   t('metrics.openPoValue'),
            sub:     t('metrics.openPoInProgress', { count: openPOs.length }),
            value:   formatCurrency(openPoValue),
            icon:    '📤',
            bg:      'bg-orange-50',
            border:  'border-orange-200',
            text:    'text-orange-700',
            subtext: 'text-orange-500',
            tip:     t('metrics.tips.openPoValue'),
        },
        {
            label:   t('metrics.thisMonthSpend'),
            sub:     t('metrics.posReceived', { count: monthlyPOs.length }),
            value:   formatCurrency(monthlySpend),
            icon:    '📅',
            bg:      'bg-green-50',
            border:  'border-green-200',
            text:    'text-green-700',
            subtext: 'text-green-500',
            tip:     t('metrics.tips.thisMonthSpend'),
        },
        {
            label:   t('metrics.outstandingClaims'),
            sub:     t('metrics.claimsOpen', { count: claimsCount }),
            value:   formatCurrency(claimsValue),
            icon:    '⚠️',
            bg:      claimsCount ? 'bg-red-50'      : 'bg-gray-50',
            border:  claimsCount ? 'border-red-200'  : 'border-gray-200',
            text:    claimsCount ? 'text-red-700'    : 'text-gray-500',
            subtext: claimsCount ? 'text-red-400'    : 'text-gray-400',
            tip:     t('metrics.tips.outstandingClaims'),
        },
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 shrink-0">
            {cards.map(c => (
                <Tip key={c.label} text={c.tip}>
                    <div className={`rounded-xl border ${c.border} ${c.bg} px-4 py-3 flex items-center gap-3 cursor-default`}>
                        <span className="text-2xl shrink-0">{c.icon}</span>
                        <div className="min-w-0">
                            <p className={`text-[11px] font-semibold uppercase tracking-wide ${c.subtext}`}>{c.label}</p>
                            <p className={`text-xl font-bold leading-tight ${c.text}`}>{c.value}</p>
                            <p className={`text-[11px] ${c.subtext}`}>{c.sub}</p>
                        </div>
                    </div>
                </Tip>
            ))}
        </div>
    )
}

// ─── Supplier scorecard ───────────────────────────────────────────────────────

type SupplierMetric = {
    vendor_id:          number
    vendor_name:        string
    total_pos:          number
    on_time_pct:        number | null
    backorder_rate:     number | null
    damage_rate:        number | null
    avg_lead_time_days: number | null
}

function metricColor(value: number | null, thresholds: [number, number], invert = false): string {
    if (value === null) return 'text-gray-400'
    const [warn, bad] = thresholds
    if (!invert) {
        if (value >= warn) return 'text-green-600'
        if (value >= bad)  return 'text-amber-500'
        return 'text-red-500'
    } else {
        if (value <= warn) return 'text-green-600'
        if (value <= bad)  return 'text-amber-500'
        return 'text-red-500'
    }
}

function SupplierScorecard({ dealershipId }: { dealershipId: string }) {
    const t = useTranslations('purchase')
    const [metrics, setMetrics]   = useState<SupplierMetric[]>([])
    const [open,    setOpen]      = useState(false)
    const [loading, setLoading]   = useState(false)

    useEffect(() => {
        if (!open || !dealershipId) return
        setLoading(true)
        supabase
            .from('supplier_performance_mv')
            .select('*')
            .eq('dealership_id', dealershipId)
            .then(({ data }) => {
                setMetrics((data ?? []) as SupplierMetric[])
                setLoading(false)
            })
    }, [open, dealershipId])

    return (
        <div className="shrink-0 mb-4 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <span>📊</span> {t('scorecard.title')}
                    <span className="text-xs font-normal text-gray-400">{t('scorecard.period')}</span>
                </span>
                <span className="text-gray-400 text-xs">{open ? t('scorecard.hide') : t('scorecard.show')}</span>
            </button>

            {open && (
                <div className="border-t border-gray-100 overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-20 text-gray-400 text-sm">{t('scorecard.loading')}</div>
                    ) : metrics.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                            {t('scorecard.noData')}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                    <th className="text-left px-4 py-2 font-medium">{t('scorecard.cols.supplier')}</th>
                                    <th className="text-center px-4 py-2 font-medium">{t('scorecard.cols.pos')}</th>
                                    <th className="text-center px-4 py-2 font-medium">{t('scorecard.cols.onTime')}</th>
                                    <th className="text-center px-4 py-2 font-medium">{t('scorecard.cols.backorder')}</th>
                                    <th className="text-center px-4 py-2 font-medium">{t('scorecard.cols.damage')}</th>
                                    <th className="text-center px-4 py-2 font-medium">{t('scorecard.cols.leadTime')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.map((m) => (
                                    <tr key={m.vendor_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5 font-medium text-gray-800 truncate max-w-[180px]">
                                            {m.vendor_name}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-gray-500">{m.total_pos}</td>
                                        <td className={`px-4 py-2.5 text-center font-semibold ${metricColor(m.on_time_pct, [90, 70])}`}>
                                            {m.on_time_pct !== null ? `${m.on_time_pct}%` : '—'}
                                        </td>
                                        <td className={`px-4 py-2.5 text-center font-semibold ${metricColor(m.backorder_rate, [5, 15], true)}`}>
                                            {m.backorder_rate !== null ? `${m.backorder_rate}%` : '—'}
                                        </td>
                                        <td className={`px-4 py-2.5 text-center font-semibold ${metricColor(m.damage_rate, [1, 5], true)}`}>
                                            {m.damage_rate !== null ? `${m.damage_rate}%` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-gray-600">
                                            {m.avg_lead_time_days !== null ? `${m.avg_lead_time_days}d` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchasePage() {
    const t = useTranslations('purchase')
    const { lowStockAlerts, motorcycles, spareParts, accessories } = useInventory()

    const [activeStatus,      setActiveStatus]      = useState<POStatus | 'All'>('All')
    const [search,            setSearch]            = useState('')
    const [supplierFilter,    setSupplierFilter]    = useState('')
    const [selectedPO,        setSelectedPO]        = useState<PurchaseOrder | null>(null)
    const [qtyOverrides,      setQtyOverrides]      = useState<Record<string, number>>({})
    const [showCreatePO,      setShowCreatePO]      = useState(false)
    const [showImportPO,      setShowImportPO]      = useState(false)
    const [userPOs,           setUserPOs]           = useState<PurchaseOrder[]>([])
    const [historicalPOs,     setHistoricalPOs]     = useState<PurchaseOrder[]>([])
    const [poStatusOverrides, setPoStatusOverrides] = useState<Record<string, POStatus>>({})
    const [poItemOverrides,   setPoItemOverrides]   = useState<Record<string, POLineItem[]>>({})
    const [poEtaOverrides,    setPoEtaOverrides]    = useState<Record<string, string>>({})
    const [dealerSuppliers,   setDealerSuppliers]   = useState<string[]>([])
    const [supplierEmails,    setSupplierEmails]    = useState<Record<string, string>>({})
    const [vendorMOQs,        setVendorMOQs]        = useState<Record<string, number>>({})
    const [approvalThreshold, setApprovalThreshold] = useState<number | undefined>(undefined)

    // Fetch POs from Supabase on mount; also load status overrides for auto-POs
    useEffect(() => {
        async function loadHistoricalPOs() {
            const dealershipId = getDealershipId()
            if (!dealershipId) return
            setDealershipId(dealershipId)
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
                approvalStatus:    po.approval_status as POApprovalStatus ?? undefined,
                approvalNote:      po.approval_note ?? undefined,
                supplierConfirmed: po.supplier_confirmed ?? undefined,
                confirmedAt:       po.confirmed_at ?? undefined,
                items: (items ?? [])
                    .filter((li) => li.po_id === po.id)
                    .map((li) => ({
                        inventoryId:    li.inventory_id,
                        name:           li.name,
                        articleNumber:  li.article_number,
                        orderQty:       li.order_qty,
                        unitCost:       Number(li.unit_cost),
                        lineTotal:      Number(li.line_total),
                        ...(li.size           ? { size:           li.size }                      : {}),
                        ...(li.status         ? { status:         li.status as POLineItemStatus } : {}),
                        ...(li.received_qty   ? { receivedQty:    li.received_qty }               : {}),
                        ...(li.damaged_qty    ? { damagedQty:     li.damaged_qty }                : {}),
                        ...(li.backordered_eta? { backorderedETA: li.backordered_eta }            : {}),
                        ...(li.line_notes     ? { lineNotes:      li.line_notes }                 : {}),
                    })),
            }))
            setHistoricalPOs(mapped)
        }

        async function loadSuppliers() {
            const dealershipId = getDealershipId()
            if (!dealershipId) return
            const { data } = await supabase
                .from('vendors')
                .select('name, email, moq')
                .eq('dealership_id', dealershipId)
                .eq('is_manual', true)
                .order('name')
            if (data) {
                setDealerSuppliers(data.map((r) => r.name))
                const emailMap: Record<string, string> = {}
                const moqMap:   Record<string, number> = {}
                data.forEach((r) => {
                    if (r.email) emailMap[r.name] = r.email
                    if (r.moq)   moqMap[r.name]   = r.moq
                })
                setSupplierEmails(emailMap)
                setVendorMOQs(moqMap)
            }
        }

        async function loadApprovalThreshold() {
            const dealershipId = getDealershipId()
            if (!dealershipId) return
            const { data } = await supabase
                .from('dealership_settings')
                .select('po_approval_threshold')
                .eq('dealership_id', dealershipId)
                .single()
            if (data?.po_approval_threshold) {
                setApprovalThreshold(Number(data.po_approval_threshold))
            }
        }

        loadHistoricalPOs()
        loadSuppliers()
        loadApprovalThreshold()
    }, [])

    const userIds = useMemo(() => new Set(userPOs.map((p) => p.id)), [userPOs])
    // user-created POs (optimistic) take priority over DB-loaded copies
    const allPOs  = useMemo<PurchaseOrder[]>(
        () => [...userPOs, ...historicalPOs.filter((p) => !userIds.has(p.id))],
        [userPOs, historicalPOs, userIds],
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
        const matchStatus   = activeStatus === 'All' || po.status === activeStatus
        const matchSupplier = !supplierFilter || po.vendor === supplierFilter
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
        return matchStatus && matchSupplier && matchSearch
    }), [allPOsResolved, activeStatus, supplierFilter, search])

    function handleAdjust(poId: string, inventoryId: string, delta: number) {
        const key = qtyKey(poId, inventoryId)
        setQtyOverrides((prev) => {
            const po = allPOs.find((p) => p.id === poId)
            const li = po?.items.find((i) => i.inventoryId === inventoryId)
            const current = prev[key] ?? li?.orderQty ?? 1
            return { ...prev, [key]: Math.max(1, current + delta) }
        })
    }

    async function handleSavePO(po: PurchaseOrder) {
        const dealershipId = getDealershipId()
        if (!dealershipId) {
            console.error('[PO save] No dealershipId in localStorage — cannot save')
            return
        }
        // Generate a fresh PO ID and its paired Ref No from DB to avoid collisions
        const tag = getDealershipTag()
        const freshId = await generateNextPOId(tag)
        const refNo   = poIdToRefNo(freshId)
        const poToSave = { ...po, id: freshId, refNo }
        // Optimistic update
        setUserPOs((prev) => [poToSave, ...prev])
        // Refresh next ID for the next PO
        generateNextPOId(tag).then(setNextPOId)
        // Persist to Supabase
        const { error: poErr } = await supabase.from('purchase_orders').insert({
            id:              poToSave.id,
            vendor:          poToSave.vendor,
            date:            poToSave.date,
            eta:             poToSave.eta,
            status:          poToSave.status,
            total_cost:      poToSave.totalCost,
            notes:           poToSave.notes           ?? null,
            approval_status: poToSave.approvalStatus  ?? null,
            approval_note:   poToSave.approvalNote    ?? null,
            dealership_id:   dealershipId,
        })
        if (poErr) {
            console.error('[PO save] purchase_orders insert failed:', poErr.message)
            return
        }
        if (poToSave.items.length > 0) {
            const { error: liErr } = await supabase.from('po_line_items').insert(
                poToSave.items.map((li) => ({
                    po_id:          poToSave.id,
                    inventory_id:   li.inventoryId,
                    name:           li.name,
                    article_number: li.articleNumber,
                    order_qty:      li.orderQty,
                    unit_cost:      li.unitCost,
                    line_total:     li.lineTotal,
                    size:           li.size ?? null,
                }))
            )
            if (liErr) console.error('[PO save] po_line_items insert failed:', liErr.message)
        }
    }

    async function handleAddToExistingPO(poId: string, newItems: POLineItem[], newEta?: string) {
        const dealershipId = getDealershipId()
        const existingPO   = allPOsResolved.find((p) => p.id === poId)
        if (!existingPO) return

        // Items flagged _replaceExisting update qty on an existing line (merge).
        // All others are genuinely new lines to append.
        type ItemWithFlag = POLineItem & { _replaceExisting?: boolean }
        const replaceItems = (newItems as ItemWithFlag[]).filter((i) => i._replaceExisting)
        const appendItems  = (newItems as ItemWithFlag[]).filter((i) => !i._replaceExisting)

        // Build merged list for optimistic update
        const updated = existingPO.items.map((ex) => {
            const r = replaceItems.find(
                (ri) => ri.inventoryId === ex.inventoryId && (ri.size ?? '') === (ex.size ?? '')
            )
            return r ? { ...ex, orderQty: r.orderQty, lineTotal: r.lineTotal } : ex
        })
        const merged   = [...updated, ...appendItems]
        const newTotal = merged.reduce((s, li) => s + li.lineTotal, 0)

        // Optimistic update
        setPoItemOverrides((prev) => ({ ...prev, [poId]: merged }))
        if (newEta) setPoEtaOverrides((prev) => ({ ...prev, [poId]: newEta }))

        if (dealershipId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatePayload: any = { total_cost: newTotal }
            if (newEta) updatePayload.eta = newEta
            await supabase.from('purchase_orders').update(updatePayload).eq('id', poId)

            // Update qty on merged (existing) lines
            for (const r of replaceItems) {
                await supabase
                    .from('po_line_items')
                    .update({ order_qty: r.orderQty, line_total: r.lineTotal })
                    .eq('po_id', poId)
                    .eq('inventory_id', r.inventoryId)
            }

            // Insert genuinely new lines
            if (appendItems.length > 0) {
                const { error: liErr } = await supabase.from('po_line_items').insert(
                    appendItems.map((li) => ({
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
                if (liErr) console.error('[PO add-to-existing] po_line_items insert failed:', liErr.message)
            }
        }
    }

    async function handleSentPO(poId: string) {
        const dealershipId = getDealershipId()
        setPoStatusOverrides((prev) => ({ ...prev, [poId]: 'Sent' }))
        setSelectedPO(null)
        const po = allPOs.find((p) => p.id === poId)
        if (po && dealershipId) {
            await supabase.from('purchase_orders').upsert({
                id:            poId,
                vendor:        po.vendor,
                date:          po.date,
                eta:           po.eta,
                status:        'Sent',
                total_cost:    po.totalCost,
                notes:         po.notes ?? null,
                dealership_id: dealershipId,
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

    async function handleMarkOrdered(
        poId: string,
        orderRef: string,
        outcome: POPlacementOutcome,
        notes: string,
        lineStatuses: Array<{ inventoryId: string; size?: string; status: POLineItemStatus; backorderedETA?: string }>,
    ) {
        const dealershipId = getDealershipId()
        const placedAt     = new Date().toISOString()
        setPoStatusOverrides((prev) => ({ ...prev, [poId]: 'Sent' }))
        setHistoricalPOs((prev) =>
            prev.map((p) =>
                p.id !== poId ? p : {
                    ...p,
                    status:           'Sent',
                    supplierOrderRef: orderRef || undefined,
                    placedAt,
                    placementOutcome: outcome || undefined,
                    placementNotes:   notes || undefined,
                    items: p.items.map((li) => {
                        const ls = lineStatuses.find(
                            (s) => s.inventoryId === li.inventoryId && (s.size ?? '') === (li.size ?? '')
                        )
                        return ls ? { ...li, status: ls.status, backorderedETA: ls.backorderedETA } : li
                    }),
                }
            ),
        )
        setSelectedPO(null)
        if (dealershipId) {
            const { error } = await supabase
                .from('purchase_orders')
                .update({
                    status:             'Sent',
                    supplier_order_ref: orderRef || null,
                    placed_at:          placedAt,
                    placement_outcome:  outcome || null,
                    placement_notes:    notes  || null,
                })
                .eq('id', poId)
            if (error) console.error('[Purchase] Mark ordered update failed:', error.message, error.details)
            // Save per-line statuses
            for (const ls of lineStatuses) {
                const q = supabase
                    .from('po_line_items')
                    .update({ status: ls.status, backordered_eta: ls.backorderedETA ?? null })
                    .eq('po_id', poId)
                    .eq('inventory_id', ls.inventoryId)
                const { error: liErr } = await (ls.size ? q.eq('size', ls.size) : q.is('size', null))
                if (liErr) console.error('[Purchase] Line status update failed:', liErr.message)
            }
        }
    }

    async function handleReceiveGoods(
        poId: string,
        receipts: Array<{ inventoryId: string; size?: string; receivedQty: number; damagedQty: number }>,
    ): Promise<SupplierClaim[]> {
        const dealershipId = getDealershipId()
        const po           = allPOsResolved.find((p) => p.id === poId)
        const claims: SupplierClaim[] = []

        for (const r of receipts) {
            const li = po?.items.find(
                (l) => l.inventoryId === r.inventoryId && (l.size ?? '') === (r.size ?? '')
            )
            const outstanding   = li ? li.orderQty - (li.receivedQty ?? 0) : r.receivedQty
            const newStatus: POLineItemStatus =
                r.receivedQty === 0         ? 'backordered' :
                r.damagedQty  > 0           ? 'damaged'     :
                r.receivedQty >= outstanding ? 'received'    :
                'pending'

            if (dealershipId) {
                const q = supabase
                    .from('po_line_items')
                    .update({ received_qty: r.receivedQty, damaged_qty: r.damagedQty, status: newStatus })
                    .eq('po_id', poId)
                    .eq('inventory_id', r.inventoryId)
                const { error } = await (r.size ? q.eq('size', r.size) : q.is('size', null))
                if (error) console.error('[Purchase] Receive goods update failed:', error.message)
            }

            if (r.damagedQty > 0 && dealershipId && li && po) {
                const claimId  = `CLM-${poId}-${li.articleNumber}${r.size ? `-${r.size}` : ''}`
                const claimRow = {
                    id:             claimId,
                    po_id:          poId,
                    vendor:         po.vendor,
                    inventory_id:   r.inventoryId,
                    item_name:      li.name,
                    article_number: li.articleNumber,
                    size:           r.size ?? null,
                    claim_type:     'damaged',
                    claimed_qty:    r.damagedQty,
                    status:         'open',
                    created_at:     new Date().toISOString(),
                    dealership_id:  dealershipId,
                }
                const { error } = await supabase.from('supplier_claims').insert(claimRow)
                if (error) console.error('[Purchase] Supplier claim insert failed:', error.message)
                else claims.push({
                    id: claimId, poId, vendor: po.vendor,
                    inventoryId: r.inventoryId, itemName: li.name,
                    articleNumber: li.articleNumber, size: r.size,
                    claimType: 'damaged', claimedQty: r.damagedQty,
                    status: 'open', createdAt: claimRow.created_at, dealershipId,
                })
            }
        }

        // Optimistic update — update line statuses in historicalPOs
        setHistoricalPOs((prev) =>
            prev.map((p) => {
                if (p.id !== poId) return p
                const updatedItems = p.items.map((li) => {
                    const r = receipts.find(
                        (r) => r.inventoryId === li.inventoryId && (r.size ?? '') === (li.size ?? '')
                    )
                    if (!r) return li
                    const outstanding   = li.orderQty - (li.receivedQty ?? 0)
                    const newStatus: POLineItemStatus =
                        r.receivedQty === 0         ? 'backordered' :
                        r.damagedQty  > 0           ? 'damaged'     :
                        r.receivedQty >= outstanding ? 'received'    :
                        'pending'
                    return { ...li, receivedQty: r.receivedQty, damagedQty: r.damagedQty, status: newStatus }
                })
                const allDone = updatedItems.every((li) => li.status === 'received' || li.status === 'damaged')
                if (allDone) {
                    setPoStatusOverrides((ov) => ({ ...ov, [poId]: 'Received' }))
                    if (dealershipId) supabase.from('purchase_orders').update({ status: 'Received' }).eq('id', poId).then(() => {})
                }
                return { ...p, items: updatedItems }
            })
        )

        return claims
    }

    async function handleMarkSupplierConfirmed(poId: string) {
        const dealershipId = getDealershipId()
        const confirmedAt  = new Date().toISOString()
        const patch = { supplierConfirmed: true as const, confirmedAt }
        setHistoricalPOs((prev) => prev.map((p) => p.id === poId ? { ...p, ...patch } : p))
        setSelectedPO((prev)    => prev?.id === poId ? { ...prev, ...patch } : prev)
        if (dealershipId) {
            const { error } = await supabase
                .from('purchase_orders')
                .update({ supplier_confirmed: true, confirmed_at: confirmedAt })
                .eq('id', poId)
            if (error) console.error('[Purchase] Mark supplier confirmed failed:', error.message)
        }
    }

    async function handleApprove(poId: string) {
        const dealershipId = getDealershipId()
        const patch = { approvalStatus: 'approved' as POApprovalStatus }
        setHistoricalPOs((prev) => prev.map((p) => p.id === poId ? { ...p, ...patch } : p))
        setUserPOs((prev)       => prev.map((p) => p.id === poId ? { ...p, ...patch } : p))
        setSelectedPO((prev)    => prev?.id === poId ? { ...prev, ...patch } : prev)
        if (dealershipId) {
            await supabase.from('purchase_orders').update({ approval_status: 'approved' }).eq('id', poId)
        }
    }

    async function handleReject(poId: string, note: string) {
        const dealershipId = getDealershipId()
        const patch = { approvalStatus: 'rejected' as POApprovalStatus, approvalNote: note }
        setHistoricalPOs((prev) => prev.map((p) => p.id === poId ? { ...p, ...patch } : p))
        setUserPOs((prev)       => prev.map((p) => p.id === poId ? { ...p, ...patch } : p))
        setSelectedPO((prev)    => prev?.id === poId ? { ...prev, ...patch } : prev)
        if (dealershipId) {
            await supabase.from('purchase_orders').update({ approval_status: 'rejected', approval_note: note || null }).eq('id', poId)
        }
    }

    async function handleReviewedPO(poId: string, items: POLineItem[], eta: string) {
        const dealershipId = getDealershipId()
        setPoStatusOverrides((prev) => ({ ...prev, [poId]: 'Reviewed' }))
        setPoItemOverrides((prev)   => ({ ...prev, [poId]: items }))
        setPoEtaOverrides((prev)    => ({ ...prev, [poId]: eta }))
        setSelectedPO(null)
        const po = allPOs.find((p) => p.id === poId)
        if (po && dealershipId) {
            const total = items.reduce((s, li) => s + li.lineTotal, 0)
            await supabase.from('purchase_orders').upsert({
                id:            poId,
                vendor:        po.vendor,
                date:          po.date,
                eta:           eta || po.eta,
                status:        'Reviewed',
                total_cost:    total || po.totalCost,
                notes:         po.notes ?? null,
                dealership_id: dealershipId,
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

    const [dealershipId, setDealershipId] = useState('')
    const [nextPOId, setNextPOId] = useState('')
    useEffect(() => {
        const id = getDealershipId()
        const tag = getDealershipTag()
        if (!id) return
        generateNextPOId(tag).then(setNextPOId)
    }, [historicalPOs, userPOs])
    const TAB_TIPS: Record<string, string> = {
        All:      t('tabs.tips.all'),
        Draft:    t('tabs.tips.draft'),
        Reviewed: t('tabs.tips.reviewed'),
        Sent:     t('tabs.tips.sent'),
        Received: t('tabs.tips.received'),
    }
    const statusLabel = (s: POStatus | 'All') => ({
        All:      t('tabs.all'),
        Draft:    t('status.draft'),
        Reviewed: t('status.reviewed'),
        Sent:     t('status.sent'),
        Received: t('status.received'),
    }[s] ?? s)
    const approvalLabel: Record<POApprovalStatus, string> = {
        pending_approval: t('approval.pendingApproval'),
        approved:         t('approval.approved'),
        rejected:         t('approval.rejected'),
    }

    const tabs: (POStatus | 'All')[] = ['All', ...ALL_STATUSES]

    const poCols = useMemo<ColDef<PurchaseOrder>[]>(() => [
        {
            label: t('cols.poNumber'),
            defaultWidth: 170,
            cell: po => (
                <span className="font-mono text-sm font-semibold text-gray-800">{po.id}</span>
            ),
        },
        {
            label: t('cols.refNo'),
            defaultWidth: 170,
            cell: po => {
                const ref = po.refNo ?? poIdToRefNo(po.id)
                return (
                    <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {ref}
                    </span>
                )
            },
        },
        {
            label: t('cols.vendor'),
            defaultWidth: 180,
            cell: po => <span className="text-gray-700 text-sm truncate block">{po.vendor}</span>,
        },
        {
            label: t('cols.date'),
            defaultWidth: 110,
            cell: po => <span className="text-gray-500 text-sm">{po.date}</span>,
        },
        {
            label: t('cols.items'),
            defaultWidth: 100,
            cell: po => (
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    {t('items', { count: po.items.length })}
                </span>
            ),
        },
        {
            label: t('cols.totalCost'),
            defaultWidth: 130,
            cell: po => {
                const effTotal = po.items.reduce((sum, li) => {
                    const qty = qtyOverrides[qtyKey(po.id, li.inventoryId)] ?? li.orderQty
                    return sum + qty * li.unitCost
                }, 0)
                return <span className="text-gray-800 font-semibold text-sm">{formatCurrency(effTotal)}</span>
            },
        },
        {
            label: t('cols.eta'),
            defaultWidth: 110,
            cell: po => <span className="text-gray-500 text-sm">{po.eta}</span>,
        },
        {
            label: t('cols.status'),
            defaultWidth: 160,
            cell: po => {
                const displayStatus = poStatusOverrides[po.id] ?? po.status
                const style         = STATUS_STYLE[displayStatus] ?? STATUS_STYLE['Draft']
                const chaserDays    = po.placedAt && displayStatus === 'Sent' ? businessDaysSince(po.placedAt) : 0
                const needsChaser   = chaserDays >= 5
                const approvalSt    = po.approvalStatus
                return (
                    <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {displayStatus}
                        </span>
                        {needsChaser && (
                            <span className="inline-flex items-center text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">
                                {t('status.followUp', { days: chaserDays })}
                            </span>
                        )}
                        {approvalSt && (
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${APPROVAL_BADGE[approvalSt]}`}>
                                {approvalLabel[approvalSt]}
                            </span>
                        )}
                    </div>
                )
            },
        },
    ], [qtyOverrides, poStatusOverrides, t, approvalLabel])

    const poDefaultWidths = useMemo(() => poCols.map(c => c.defaultWidth), [poCols])

    return (
        <div className="flex min-h-screen">
        <Sidebar />
        <div className="lg:ml-64 h-screen overflow-hidden flex flex-col bg-white w-full">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
                <span className="text-sm text-gray-500 font-medium">{t('topbar.title')}</span>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder={t('topbar.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 w-60"
                    />
                </div>
            </div>

            {/* Page body */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Page header */}
                <div className="flex items-start justify-between mb-5 shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('page.title')}</h1>
                        <p className="text-sm text-gray-400 mt-0.5">{t('page.description')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Supplier filter — applies to both alerts and PO table */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{t('filter.label')}</span>
                            <select
                                value={supplierFilter}
                                onChange={e => setSupplierFilter(e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg bg-gray-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                            >
                                <option value="">{t('filter.allSuppliers')}</option>
                                {[...new Set([
                                    ...allPOs.map(p => p.vendor),
                                    ...dealerSuppliers,
                                ])].sort().map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <Link
                            href="/purchase/daily"
                            className="bg-white hover:bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            {t('buttons.dailyActions')}
                        </Link>
                        <button
                            onClick={() => setShowImportPO(true)}
                            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            {t('buttons.importExcel')}
                        </button>
                        <button
                            onClick={() => setShowCreatePO(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            {t('buttons.createPo')}
                        </button>
                    </div>
                </div>

                {/* Low stock banner */}
                {lowStockAlerts.length > 0 && (
                    <Link
                        href="/inventory/low-stock"
                        className="shrink-0 mb-4 flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl px-4 py-3 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">⚠</span>
                            <div>
                                <span className="text-sm font-semibold text-amber-800">
                                    {t('lowStock.alert', { count: lowStockAlerts.length })}
                                </span>
                                <span className="text-xs text-amber-600 ml-2 hidden sm:inline">
                                    {t('lowStock.hint')}
                                </span>
                            </div>
                        </div>
                        <span className="text-amber-600 text-sm font-medium group-hover:translate-x-0.5 transition-transform shrink-0">
                            {t('lowStock.viewButton')}
                        </span>
                    </Link>
                )}

                <div className="shrink-0"><SummaryCards allPOs={allPOsResolved} filtered={filtered} /></div>
                {dealershipId && <FinancialMetrics dealershipId={dealershipId} allPOs={allPOsResolved} />}
                {dealershipId && <SupplierScorecard dealershipId={dealershipId} />}

                {/* Status tabs */}
                <div className="flex gap-1 overflow-x-auto mb-4 pb-1 shrink-0">
                    {tabs.map((tab) => (
                        <Tip key={tab} text={TAB_TIPS[tab]}>
                            <button
                                onClick={() => setActiveStatus(tab)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                    activeStatus === tab
                                        ? 'bg-orange-500 text-white'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {statusLabel(tab)}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                    activeStatus === tab ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-500'
                                }`}>
                                    {statusCounts[tab] ?? 0}
                                </span>
                            </button>
                        </Tip>
                    ))}
                </div>

                {/* PO table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                    {filtered.length === 0 ? (
                        allPOs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <span className="text-5xl">📦</span>
                                <div className="text-center">
                                    <p className="text-gray-700 font-semibold">{t('empty.title')}</p>
                                    <p className="text-gray-400 text-sm mt-1">{t('empty.description')}</p>
                                </div>
                                <button
                                    onClick={() => setShowImportPO(true)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {t('empty.importButton')}
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <span className="text-3xl mb-2">📭</span>
                                <p className="text-sm">{t('empty.filtered')}</p>
                            </div>
                        )
                    ) : (
                        <ReorderableTable<PurchaseOrder>
                            cols={poCols}
                            data={filtered}
                            defaultWidths={poDefaultWidths}
                            onRowClick={po => setSelectedPO(po)}
                            rowKey={po => po.id}
                        />
                    )}
                </div>
            </div>

            {/* Import PO modal */}
            {showImportPO && (
                <ImportPOModal
                    existingPOs={allPOs}
                    onImported={(newPOs) => {
                        setUserPOs((prev) => [...newPOs, ...prev])
                    }}
                    onClose={() => setShowImportPO(false)}
                />
            )}

            {/* Create PO modal — see components/CreatePOModal.tsx */}
            {showCreatePO && (
                <CreatePOModal
                    nextPOId={nextPOId}
                    allInventoryItems={allInventoryItems}
                    suppliers={dealerSuppliers}
                    openPOs={allPOsResolved.filter((p) => p.status !== 'Received')}
                    onSave={handleSavePO}
                    onAddToExisting={handleAddToExistingPO}
                    onClose={() => setShowCreatePO(false)}
                    approvalThreshold={approvalThreshold}
                    vendorMOQMap={vendorMOQs}
                />
            )}

            {/* PO detail / review modal — see components/POModal.tsx */}
            {selectedPO && (
                <POModal
                    po={{ ...selectedPO, status: poStatusOverrides[selectedPO.id] ?? selectedPO.status }}
                    isAuto={false}
                    qtyOverrides={qtyOverrides}
                    onAdjust={handleAdjust}
                    onClose={() => setSelectedPO(null)}
                    onSent={() => handleSentPO(selectedPO.id)}
                    onReviewed={(items, eta) => handleReviewedPO(selectedPO.id, items, eta)}
                    onMarkOrdered={handleMarkOrdered}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onReceiveGoods={handleReceiveGoods}
                    onMarkSupplierConfirmed={handleMarkSupplierConfirmed}
                    vendorItems={selectedVendorItems}
                    freeShippingThreshold={vendorDetails[selectedPO.vendor]?.freeShippingThreshold}
                    vendorEmailOverride={supplierEmails[selectedPO.vendor]}
                />
            )}
        </div>
        </div>
    )
}