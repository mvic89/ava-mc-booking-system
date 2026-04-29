'use client'

import { useState, useMemo, useEffect } from 'react'
import { useInventory } from '@/context/InventoryContext'
import { supabase } from '@/lib/supabase'
import { getDealershipId, getDealershipTag } from '@/lib/tenant'
import { CreatePOModal, FlatInventoryItem } from '@/components/CreatePOModal'
import { POLineItem, POStatus, PurchaseOrder, LowStockAlert } from '@/utils/types'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

async function generateNextPOId(tag: string): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `PO-${tag}-${year}-`
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

function poIdToRefNo(poId: string): string {
    return poId.replace(/^PO-/, 'REF-')
}

const ITEM_TYPE_LABEL: Record<LowStockAlert['itemType'], { icon: string; label: string }> = {
    motorcycle: { icon: '🏍', label: 'Motorcycle' },
    sparePart:  { icon: '🔧', label: 'Spare Part' },
    accessory:  { icon: '🧢', label: 'Accessory' },
}

export default function LowStockPage() {
    const { lowStockAlerts, motorcycles, spareParts, accessories } = useInventory()

    const [supplierFilter,  setSupplierFilter]  = useState('')
    const [nextPOId,        setNextPOId]        = useState('')
    const [dealerSuppliers, setDealerSuppliers] = useState<string[]>([])
    const [openPOs,         setOpenPOs]         = useState<PurchaseOrder[]>([])
    const [selectedAlert,   setSelectedAlert]   = useState<LowStockAlert | null>(null)

    useEffect(() => {
        const id  = getDealershipId()
        const tag = getDealershipTag()
        if (!id) return

        generateNextPOId(tag).then(setNextPOId)

        supabase
            .from('vendors')
            .select('name')
            .eq('dealership_id', id)
            .eq('is_manual', true)
            .order('name')
            .then(({ data }) => {
                if (data) setDealerSuppliers(data.map((r) => r.name))
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
                .from('po_line_items')
                .select('*')
                .in('po_id', poIds)
            const mapped: PurchaseOrder[] = orders.map((po) => ({
                id:        po.id,
                refNo:     poIdToRefNo(po.id),
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
            setOpenPOs(mapped)
        }
        loadOpenPOs()
    }, [])

    const allInventoryItems = useMemo<FlatInventoryItem[]>(() => [
        ...motorcycles.map((m) => ({ id: m.id, name: m.name, articleNumber: m.articleNumber, vendor: m.vendor, cost: m.cost })),
        ...spareParts.map((s)  => ({ id: s.id, name: s.name, articleNumber: s.articleNumber, vendor: s.vendor, cost: s.cost })),
        ...accessories.map((a) => ({ id: a.id, name: a.name, articleNumber: a.articleNumber, vendor: a.vendor, cost: a.cost, size: a.size })),
    ], [motorcycles, spareParts, accessories])

    const allSuppliers = useMemo(
        () => [...new Set([...lowStockAlerts.map((a) => a.vendor), ...dealerSuppliers])].sort(),
        [lowStockAlerts, dealerSuppliers],
    )

    const filtered = supplierFilter
        ? lowStockAlerts.filter((a) => a.vendor === supplierFilter)
        : lowStockAlerts

    const selectedFlatItem = useMemo(() => {
        if (!selectedAlert) return null
        return allInventoryItems.find((i) => i.id === selectedAlert.inventoryId) ?? null
    }, [selectedAlert, allInventoryItems])

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
        setOpenPOs((prev) => prev.map((p) => p.id === poId ? { ...p, items: merged, totalCost: newTotal } : p))

        if (dealershipId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatePayload: any = { total_cost: newTotal }
            if (newEta) updatePayload.eta = newEta
            await supabase.from('purchase_orders').update(updatePayload).eq('id', poId)
            for (const r of replaceItems) {
                await supabase.from('po_line_items')
                    .update({ order_qty: r.orderQty, line_total: r.lineTotal })
                    .eq('po_id', poId)
                    .eq('inventory_id', r.inventoryId)
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

    return (
        <div className="flex min-h-screen">
        <Sidebar />
        <div className="lg:ml-64 h-screen overflow-hidden flex flex-col bg-white w-full">

            {/* Top bar */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 shrink-0">
                <Link
                    href="/purchase"
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                    ← Purchase Orders
                </Link>
                <span className="text-gray-300">/</span>
                <span className="text-sm text-gray-700 font-medium">Low Stock</span>
            </div>

            {/* Page body */}
            <div className="flex-1 min-h-0 p-6 flex flex-col overflow-y-auto">

                {/* Header */}
                <div className="flex items-start justify-between mb-5 shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Low Stock Alerts</h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Items at or below reorder level. Click <strong>Create PO</strong> on any row — supplier and item are pre-filled.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500 font-medium">Supplier:</span>
                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="text-sm border border-gray-200 rounded-lg bg-gray-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        >
                            <option value="">All suppliers</option>
                            {allSuppliers.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {lowStockAlerts.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-10 flex flex-col items-center gap-3 text-center">
                        <span className="text-4xl">✅</span>
                        <p className="text-sm font-semibold text-green-800">All items are above reorder level</p>
                        <p className="text-xs text-green-600">Nothing to order right now.</p>
                    </div>
                ) : (
                    <>
                        {/* Ref No callout */}
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex gap-2 text-xs text-blue-700 shrink-0">
                            <span className="font-bold shrink-0 mt-px">ℹ</span>
                            <span>
                                <strong>One PO = One Ref No.</strong> — When you create a PO the system assigns a Ref No. (e.g.{' '}
                                <span className="font-mono">REF-AVA-2026-001</span>). Enter that Ref No. on the supplier&apos;s
                                portal so their confirmation email can be matched back to this PO.
                            </span>
                        </div>

                        {/* Count badge */}
                        <div className="flex items-center gap-2 mb-3 shrink-0">
                            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                                ⚠ {filtered.length} item{filtered.length !== 1 ? 's' : ''} low{supplierFilter ? ` — ${supplierFilter}` : ''}
                            </span>
                            {supplierFilter && (
                                <button
                                    onClick={() => setSupplierFilter('')}
                                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                                >
                                    clear filter
                                </button>
                            )}
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto flex-1 min-h-0">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                                    <p className="text-sm">No low stock items for this supplier</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs uppercase text-gray-400 tracking-wider sticky top-0">
                                            <th className="px-4 py-3 w-10">Type</th>
                                            <th className="px-4 py-3">Item</th>
                                            <th className="px-4 py-3">Article No.</th>
                                            <th className="px-4 py-3">Supplier</th>
                                            <th className="px-4 py-3 text-center">Stock</th>
                                            <th className="px-4 py-3 text-center">Reorder Qty</th>
                                            <th className="px-4 py-3">Location</th>
                                            <th className="px-4 py-3 w-32" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filtered.map((alert) => (
                                            <tr
                                                key={alert.inventoryId}
                                                className="hover:bg-amber-50/40 transition-colors"
                                            >
                                                <td className="px-4 py-3 text-base text-center">
                                                    <span title={ITEM_TYPE_LABEL[alert.itemType].label}>
                                                        {ITEM_TYPE_LABEL[alert.itemType].icon}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-800">{alert.name}</p>
                                                    <p className="text-xs text-gray-400">{alert.brand}</p>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                                                    {alert.articleNumber}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 text-xs">
                                                    {alert.vendor}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-red-600 font-bold text-sm">{alert.currentStock}</span>
                                                    <span className="text-gray-400 text-xs ml-1">left</span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-500 text-sm">
                                                    {alert.reorderQty}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {alert.location ? (
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono text-xs">
                                                            {alert.location}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => setSelectedAlert(alert)}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                    >
                                                        + Create PO
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Create PO modal — pre-filled from the selected alert */}
            {selectedAlert && selectedFlatItem && (
                <CreatePOModal
                    nextPOId={nextPOId}
                    allInventoryItems={allInventoryItems}
                    suppliers={dealerSuppliers}
                    openPOs={openPOs}
                    onSave={handleSavePO}
                    onAddToExisting={handleAddToExistingPO}
                    onClose={() => setSelectedAlert(null)}
                    defaultVendor={selectedAlert.vendor}
                    defaultItems={[{ item: selectedFlatItem, qty: selectedAlert.reorderQty }]}
                />
            )}
        </div>
        </div>
    )
}
