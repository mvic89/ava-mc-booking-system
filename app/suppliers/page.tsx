'use client'

import { useMemo, useState, useEffect } from 'react'
import { useInventory }  from '@/context/InventoryContext'
import { vendorDetails } from '@/data/vendors'
import { historicalPOs } from '@/data/purchaseOrders'
import { POModal, STATUS_STYLE, formatCurrency, qtyKey } from '@/components/POModal'
import { SupplierRow, CATEGORY_STYLE } from '@/components/SupplierFormShared'
import { AddSupplierModal }     from '@/components/AddSupplierModal'
import { SupplierDetailModal }  from '@/components/SupplierDetailModal'
import { BaseInventoryItem, POLineItem, POStatus, PurchaseOrder } from '@/utils/types'
import { supabase } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_ORDER = ['Under Review', 'Draft', 'Reviewed', 'Sent', 'Received']

function supNum(n: number) {
    return `SUP-${String(n).padStart(3, '0')}`
}

// ─── Build supplier rows from inventory ───────────────────────────────────────

function buildSuppliers(
    motorcycles: BaseInventoryItem[],
    spareParts:  BaseInventoryItem[],
    accessories: BaseInventoryItem[],
): Omit<SupplierRow, 'supplierNumber'>[] {
    const map = new Map<string, Omit<SupplierRow, 'supplierNumber'>>()

    function absorb(items: BaseInventoryItem[], category: string) {
        for (const item of items) {
            const detail   = vendorDetails[item.vendor]
            const existing = map.get(item.vendor) ?? {
                name:                  item.vendor,
                address:               detail?.address               ?? '—',
                phone:                 detail?.phone                 ?? '—',
                orgNumber:             detail?.orgNumber             ?? '—',
                itemCount:             0,
                categories:            [],
                lowStockCount:         0,
                hasDetails:            !!detail,
                freeShippingThreshold: detail?.freeShippingThreshold,
            }
            existing.itemCount++
            if (!existing.categories.includes(category)) existing.categories.push(category)
            if (item.stock <= item.reorderQty) existing.lowStockCount++
            map.set(item.vendor, existing)
        }
    }

    absorb(motorcycles, 'Motorcycles')
    absorb(spareParts,  'Spare Parts')
    absorb(accessories, 'Accessories')

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ suppliers }: { suppliers: SupplierRow[] }) {
    const withDetails  = suppliers.filter((s) => s.hasDetails).length
    const withLowStock = suppliers.filter((s) => s.lowStockCount > 0).length
    const totalSKUs    = suppliers.reduce((sum, s) => sum + s.itemCount, 0)

    const cards = [
        { label: 'Total Suppliers',      value: suppliers.length, icon: '🏭', color: 'bg-blue-50 text-blue-700'    },
        { label: 'With Contact Details', value: withDetails,      icon: '📋', color: 'bg-green-50 text-green-700'  },
        { label: 'Low Stock Alerts',     value: withLowStock,     icon: '⚠️', color: 'bg-amber-50 text-amber-700'  },
        { label: 'Total SKUs Supplied',  value: totalSKUs,        icon: '📦', color: 'bg-orange-50 text-orange-700' },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

// ─── Supplier PO list modal ───────────────────────────────────────────────────
// Shows all POs for a given supplier before drilling into a single PO.

function SupplierPOListModal({
    supplier, pos, autoIds, onSelectPO, onClose,
}: {
    supplier:   SupplierRow
    pos:        PurchaseOrder[]
    autoIds:    Set<string>
    onSelectPO: (po: PurchaseOrder) => void
    onClose:    () => void
}) {
    const sorted = [...pos].sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status)
        const bi = STATUS_ORDER.indexOf(b.status)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">
                            Purchase Orders
                        </p>
                        <h2 className="text-xl font-bold text-gray-900">{supplier.name}</h2>
                        <span className="text-xs font-mono text-orange-600">{supplier.supplierNumber}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0 mt-1"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-3">
                        {pos.length} PO{pos.length !== 1 ? 's' : ''} found
                    </p>

                    {sorted.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                            <span className="text-3xl mb-2">📭</span>
                            <p className="text-sm">No purchase orders for this supplier</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sorted.map((po) => {
                                const style  = STATUS_STYLE[po.status] ?? STATUS_STYLE['Draft']
                                const isAuto = autoIds.has(po.id)
                                return (
                                    <button
                                        key={po.id}
                                        onClick={() => onSelectPO(po)}
                                        className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-colors group"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono font-bold text-gray-800 text-sm">{po.id}</span>
                                                {isAuto && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">AUTO</span>
                                                )}
                                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                    {po.status}
                                                </span>
                                            </div>
                                            <span className="text-gray-400 text-xs group-hover:text-orange-500 shrink-0">▶</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                                            <span>{po.items.length} item{po.items.length !== 1 ? 's' : ''}</span>
                                            <span className="font-semibold text-gray-700">{formatCurrency(po.totalCost)}</span>
                                            <span>Date: {po.date}</span>
                                            {po.eta !== '—' && <span>ETA: {po.eta}</span>}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="px-7 py-4 border-t border-gray-100 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
    const { autoPOs, motorcycles, spareParts, accessories } = useInventory()

    const [search,          setSearch]          = useState('')
    const [detailSupplier,  setDetailSupplier]  = useState<SupplierRow | null>(null)
    const [poListSupplier,  setPoListSupplier]  = useState<SupplierRow | null>(null)
    const [selectedPO,      setSelectedPO]      = useState<PurchaseOrder | null>(null)
    const [qtyOverrides,      setQtyOverrides]      = useState<Record<string, number>>({})
    const [showAddSupplier,   setShowAddSupplier]   = useState(false)
    const [manualSuppliers,   setManualSuppliers]   = useState<SupplierRow[]>([])
    const [supplierEdits,     setSupplierEdits]     = useState<Record<string, Partial<SupplierRow>>>({})
    const [poStatusOverrides, setPoStatusOverrides] = useState<Record<string, POStatus>>({})

    const allPOs = useMemo<PurchaseOrder[]>(
        () => [...autoPOs, ...historicalPOs].map((po) =>
            poStatusOverrides[po.id] ? { ...po, status: poStatusOverrides[po.id] } : po
        ),
        [autoPOs, poStatusOverrides],
    )
    const autoIds = useMemo(() => new Set(autoPOs.map((p) => p.id)), [autoPOs])

    const inventorySuppliers = useMemo(
        () => buildSuppliers(motorcycles, spareParts, accessories),
        [motorcycles, spareParts, accessories],
    )

    const suppliers = useMemo<SupplierRow[]>(() => {
        const inventoryNames = new Set(inventorySuppliers.map((s) => s.name))
        const uniqueManual   = manualSuppliers.filter((m) => !inventoryNames.has(m.name))
        const numberedInv: SupplierRow[] = inventorySuppliers.map((s, i) => ({
            ...s,
            ...(supplierEdits[s.name] ?? {}),
            supplierNumber: supNum(i + 1),
        }))
        const editedManual: SupplierRow[] = uniqueManual.map((m) => ({
            ...m,
            ...(supplierEdits[m.name] ?? {}),
        }))
        return [...numberedInv, ...editedManual]
    }, [inventorySuppliers, manualSuppliers, supplierEdits])

    const nextSupplierNumber = supNum(inventorySuppliers.length + manualSuppliers.length + 1)

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        if (!q) return suppliers
        return suppliers.filter((s) =>
            s.name.toLowerCase().includes(q) ||
            s.address.toLowerCase().includes(q) ||
            s.phone.toLowerCase().includes(q) ||
            s.orgNumber.toLowerCase().includes(q) ||
            s.categories.some((c) => c.toLowerCase().includes(q))
        )
    }, [suppliers, search])

    function handleAdjust(poId: string, inventoryId: string, delta: number) {
        const key = qtyKey(poId, inventoryId)
        setQtyOverrides((prev) => {
            const po = allPOs.find((p) => p.id === poId)
            const li = po?.items.find((i) => i.inventoryId === inventoryId)
            const current = prev[key] ?? li?.orderQty ?? 1
            return { ...prev, [key]: Math.max(1, current + delta) }
        })
    }

    // ─── Load persisted data from Supabase on mount ───────────────────────────
    useEffect(() => {
        async function load() {
            // Load PO status overrides
            const { data: poData } = await supabase
                .from('purchase_orders')
                .select('id, status')
            if (poData && poData.length > 0) {
                const overrides: Record<string, POStatus> = {}
                for (const row of poData) {
                    overrides[row.id] = row.status as POStatus
                }
                setPoStatusOverrides(overrides)
            }

            // Load vendor edits and manual suppliers
            const { data: vendorData } = await supabase
                .from('vendors')
                .select('*')
            if (vendorData && vendorData.length > 0) {
                const edits: Record<string, Partial<SupplierRow>> = {}
                const manual: SupplierRow[] = []
                for (const row of vendorData) {
                    const { name, is_manual, supplier_number, ...rest } = row
                    edits[name] = {
                        address:               rest.address,
                        phone:                 rest.phone,
                        orgNumber:             rest.org_number,
                        freeShippingThreshold: rest.free_shipping_threshold,
                    }
                    if (is_manual) {
                        manual.push({
                            name,
                            supplierNumber: supplier_number ?? '',
                            address:        rest.address   ?? '—',
                            phone:          rest.phone     ?? '—',
                            orgNumber:      rest.org_number ?? '—',
                            itemCount:      0,
                            categories:     rest.categories ?? [],
                            lowStockCount:  0,
                            hasDetails:     true,
                            isManual:       true,
                            freeShippingThreshold: rest.free_shipping_threshold,
                        })
                    }
                }
                setSupplierEdits(edits)
                if (manual.length > 0) setManualSuppliers(manual)
            }
        }
        load()
    }, [])

    async function handleReviewedPO(poId: string, items: POLineItem[], eta: string) {
        setPoStatusOverrides((prev) => ({ ...prev, [poId]: 'Reviewed' }))
        setSelectedPO((prev) => prev ? { ...prev, status: 'Reviewed' } : prev)

        const po = allPOs.find((p) => p.id === poId)
        if (po) {
            const lineItems  = items.length > 0 ? items : po.items
            const totalCost  = lineItems.reduce((s, li) => s + li.lineTotal, 0)
            await supabase.from('purchase_orders').upsert({
                id:         poId,
                vendor:     po.vendor,
                date:       po.date,
                eta:        eta || po.eta,
                status:     'Reviewed',
                total_cost: totalCost || po.totalCost,
                notes:      po.notes ?? null,
            }, { onConflict: 'id' })
            // Persist line items: delete old, insert updated
            await supabase.from('po_line_items').delete().eq('po_id', poId)
            if (lineItems.length > 0) {
                await supabase.from('po_line_items').insert(
                    lineItems.map((li) => ({
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
            // Persist line items
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

    async function handleEditSupplier(name: string, updates: Partial<SupplierRow>) {
        setSupplierEdits((prev) => ({ ...prev, [name]: { ...(prev[name] ?? {}), ...updates } }))
        setDetailSupplier((prev) => (prev?.name === name ? { ...prev, ...updates } : prev))
        await supabase.from('vendors').upsert({
            name,
            address:                updates.address,
            phone:                  updates.phone,
            org_number:             updates.orgNumber,
            free_shipping_threshold: updates.freeShippingThreshold,
            is_manual:              false,
        }, { onConflict: 'name' })
    }

    const supplierPOs = useMemo(
        () => (poListSupplier ? allPOs.filter((po) => po.vendor === poListSupplier.name) : []),
        [poListSupplier, allPOs],
    )

    return (
        <div className="lg:ml-64 min-h-screen flex flex-col bg-white">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
                <span className="text-sm text-gray-500 font-medium">Suppliers</span>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Search supplier, category..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 w-64"
                    />
                </div>
            </div>

            {/* Page body */}
            <div className="flex-1 overflow-auto p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Click any row to view supplier details. All vendors matched from inventory.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddSupplier(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                        + Add Supplier
                    </button>
                </div>

                <SummaryCards suppliers={suppliers} />

                {/* Supplier table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <span className="text-3xl mb-2">🔍</span>
                            <p className="text-sm">No suppliers match your search</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500 tracking-wider">
                                    <th className="px-4 py-3">Supplier No.</th>
                                    <th className="px-4 py-3">Supplier Name</th>
                                    <th className="px-4 py-3">Address</th>
                                    <th className="px-4 py-3">Phone</th>
                                    <th className="px-4 py-3">Org Number</th>
                                    <th className="px-4 py-3 text-center">SKUs</th>
                                    <th className="px-4 py-3">Categories</th>
                                    <th className="px-4 py-3">Stock Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((s) => {
                                    const poCount = allPOs.filter((po) => po.vendor === s.name).length
                                    return (
                                        <tr
                                            key={s.name}
                                            onClick={() => setDetailSupplier(s)}
                                            className="hover:bg-orange-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3.5">
                                                <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded">
                                                    {s.supplierNumber}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="font-semibold text-gray-800 text-sm">{s.name}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {poCount > 0 ? (
                                                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">
                                                            {poCount} PO{poCount !== 1 ? 's' : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 italic">No POs</span>
                                                    )}
                                                    {s.isManual && (
                                                        <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-semibold">Manual</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-xs text-gray-500 max-w-56">
                                                <span title={s.address} className="line-clamp-2 leading-relaxed">{s.address}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{s.phone}</td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-gray-500 whitespace-nowrap">{s.orgNumber}</td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">{s.itemCount}</span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {s.categories.map((cat) => (
                                                        <span key={cat} className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[cat] ?? 'bg-gray-100 text-gray-600'}`}>
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {s.lowStockCount > 0 ? (
                                                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                        {s.lowStockCount} low stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                                        All stocked
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Supplier modal — see components/AddSupplierModal.tsx */}
            {showAddSupplier && (
                <AddSupplierModal
                    supplierNumber={nextSupplierNumber}
                    onSave={async (s) => {
                        setManualSuppliers((prev) => [...prev, s])
                        await supabase.from('vendors').upsert({
                            name:                    s.name,
                            address:                 s.address,
                            phone:                   s.phone,
                            org_number:              s.orgNumber,
                            free_shipping_threshold: s.freeShippingThreshold,
                            supplier_number:         s.supplierNumber,
                            categories:              s.categories,
                            is_manual:               true,
                        }, { onConflict: 'name' })
                    }}
                    onClose={() => setShowAddSupplier(false)}
                />
            )}

            {/* Supplier detail / edit modal — see components/SupplierDetailModal.tsx */}
            {detailSupplier && !poListSupplier && !selectedPO && (
                <SupplierDetailModal
                    supplier={detailSupplier}
                    onEdit={(updates) => handleEditSupplier(detailSupplier.name, updates)}
                    onShowPOs={() => { setPoListSupplier(detailSupplier); setDetailSupplier(null) }}
                    onClose={() => setDetailSupplier(null)}
                />
            )}

            {/* Supplier PO list modal */}
            {poListSupplier && !selectedPO && (
                <SupplierPOListModal
                    supplier={poListSupplier}
                    pos={supplierPOs}
                    autoIds={autoIds}
                    onSelectPO={(po) => setSelectedPO(po)}
                    onClose={() => setPoListSupplier(null)}
                />
            )}

            {/* PO detail modal — see components/POModal.tsx */}
            {selectedPO && (
                <POModal
                    po={selectedPO}
                    isAuto={autoIds.has(selectedPO.id)}
                    qtyOverrides={qtyOverrides}
                    onAdjust={handleAdjust}
                    onClose={() => setSelectedPO(null)}
                    onReviewed={(items, eta) => handleReviewedPO(selectedPO.id, items, eta)}
                    onSent={() => handleSentPO(selectedPO.id)}
                    zIndex="z-60"
                    freeShippingThreshold={poListSupplier?.freeShippingThreshold}
                />
            )}
        </div>
    )
}
