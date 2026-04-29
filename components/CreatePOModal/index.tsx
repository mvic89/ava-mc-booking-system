'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/components/POModal'
import { PurchaseOrder, POLineItem } from '@/utils/types'

// ─── Types ────────────────────────────────────────────────────────────────────

// Flat item shape passed in from the page (derived from all inventory categories)
export type FlatInventoryItem = {
    id:            string
    name:          string
    articleNumber: string
    vendor:        string
    cost:          number
    size?:         string
}

interface DraftRow {
    rowId:            string
    itemSearch:       string
    itemDropdownOpen: boolean
    selectedItem:     { id: string; name: string; articleNumber: string; cost: number; size?: string } | null
    qty:              number
    isDefault?:       boolean  // item locked when pre-filled from a low-stock alert
}

function emptyRow(): DraftRow {
    return {
        rowId:            Math.random().toString(36).slice(2),
        itemSearch:       '',
        itemDropdownOpen: false,
        selectedItem:     null,
        qty:              1,
    }
}

// ─── Create PO Modal ──────────────────────────────────────────────────────────
// Shown when the user clicks "+ Create PO" on the Purchase Orders page.
// Lets the user pick a supplier, add line items, and set an expected delivery date.
// If the supplier already has an open PO, prompts the user to add items to it
// or create a separate new PO.

function poIdToRefNo(poId: string): string {
    return poId.replace(/^PO-/, 'REF-')
}

export function CreatePOModal({
    nextPOId,
    allInventoryItems,
    suppliers,
    openPOs,
    onSave,
    onAddToExisting,
    onClose,
    defaultVendor,
    defaultItems,
}: {
    nextPOId:          string
    allInventoryItems: FlatInventoryItem[]
    suppliers:         string[]
    openPOs:           PurchaseOrder[]
    onSave:            (po: PurchaseOrder) => void
    onAddToExisting:   (poId: string, newItems: POLineItem[], newEta?: string) => void
    onClose:           () => void
    /** Pre-select and lock the supplier (used when opening from a low-stock alert) */
    defaultVendor?:    string
    /** Pre-populate line items (used when opening from a low-stock alert) */
    defaultItems?:     Array<{ item: FlatInventoryItem; qty: number }>
}) {
    const todayStr   = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const allVendors = useMemo(() => [...suppliers].sort(), [suppliers])

    const [vendorSearch,  setVendorSearch]  = useState(defaultVendor ?? '')
    const [vendor,        setVendor]        = useState(defaultVendor ?? '')
    const [vendorOpen,    setVendorOpen]    = useState(false)
    const [rows,          setRows]          = useState<DraftRow[]>(() => {
        if (defaultItems && defaultItems.length > 0) {
            return [
                ...defaultItems.map(({ item, qty }) => ({
                    rowId:            Math.random().toString(36).slice(2),
                    itemSearch:       item.name,
                    itemDropdownOpen: false,
                    selectedItem:     { id: item.id, name: item.name, articleNumber: item.articleNumber, cost: item.cost, size: item.size },
                    qty,
                    isDefault:        true,
                })),
                emptyRow(),
            ]
        }
        return [emptyRow(), emptyRow(), emptyRow()]
    })
    const [deliveryDate,  setDeliveryDate]  = useState('')
    // 'new' = user chose to create a new PO despite existing open one
    // 'existing' = user chose to add items to the existing PO
    // null = not decided yet (banner is visible)
    const [addMode,       setAddMode]       = useState<'new' | 'existing' | null>(null)

    // ── Conflict resolution state ───────────────────────────────────────────────
    // Populated when the user clicks "Add to PO" and some new items already exist
    // in the existing PO with the same inventoryId + size.
    interface ConflictItem {
        newItem:      POLineItem
        existingItem: POLineItem
        action:       'merge' | 'separate'  // user's choice
    }
    const [conflictStep,        setConflictStep]        = useState(false)
    const [conflictResolutions, setConflictResolutions] = useState<ConflictItem[]>([])

    // Items matching the selected supplier (used for the badge only)
    const vendorItems = useMemo(
        () => vendor ? allInventoryItems.filter((i) => i.vendor === vendor) : [],
        [vendor, allInventoryItems],
    )

    // Find any open PO for the selected supplier
    const existingOpenPO = useMemo(() => {
        if (!vendor) return null
        const openStatuses = new Set(['Draft', 'Reviewed', 'Sent'])
        return openPOs.find((p) => p.vendor === vendor && openStatuses.has(p.status)) ?? null
    }, [vendor, openPOs])

    const filteredVendors = vendorSearch
        ? allVendors.filter((v) => v.toLowerCase().includes(vendorSearch.toLowerCase()))
        : allVendors

    function selectVendor(v: string) {
        setVendor(v)
        setVendorSearch(v)
        setVendorOpen(false)
        setRows([emptyRow(), emptyRow(), emptyRow()])
        setAddMode(null)   // reset choice when supplier changes
    }

    function updateRow(rowId: string, patch: Partial<DraftRow>) {
        setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)))
    }

    function selectItem(rowId: string, item: FlatInventoryItem) {
        updateRow(rowId, {
            selectedItem:     { id: item.id, name: item.name, articleNumber: item.articleNumber, cost: item.cost, size: item.size },
            itemSearch:       item.name,
            itemDropdownOpen: false,
        })
    }

    function addRow() {
        setRows((prev) => [...prev, emptyRow()])
    }

    function removeRow(rowId: string) {
        setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev))
    }

    const grandTotal = rows.reduce((s, r) => s + (r.selectedItem ? r.qty * r.selectedItem.cost : 0), 0)
    const canSubmit  = vendor.trim() !== '' && rows.some((r) => r.selectedItem && r.qty > 0)
    // If there's an open PO and the user hasn't chosen yet, block submit until they decide
    const needsDecision = !!existingOpenPO && addMode === null

    function buildItems(): POLineItem[] {
        return rows
            .filter((r) => r.selectedItem && r.qty > 0)
            .map((r) => ({
                inventoryId:   r.selectedItem!.id,
                name:          r.selectedItem!.name,
                articleNumber: r.selectedItem!.articleNumber,
                orderQty:      r.qty,
                unitCost:      r.selectedItem!.cost,
                lineTotal:     r.qty * r.selectedItem!.cost,
                size:          r.selectedItem!.size,
            }))
    }

    function handleSubmit() {
        if (!canSubmit || needsDecision) return
        const items  = buildItems()
        const etaStr = deliveryDate
            ? new Date(deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'

        if (addMode === 'existing' && existingOpenPO) {
            // Check for conflicts: same inventoryId AND same size (or both have no size)
            const conflicts: ConflictItem[] = []
            for (const newItem of items) {
                const existing = existingOpenPO.items.find(
                    (ex) =>
                        ex.inventoryId === newItem.inventoryId &&
                        (ex.size ?? '') === (newItem.size ?? ''),
                )
                if (existing) {
                    conflicts.push({ newItem, existingItem: existing, action: 'merge' })
                }
            }
            if (conflicts.length > 0) {
                // Show conflict resolution step before saving
                setConflictResolutions(conflicts)
                setConflictStep(true)
                return
            }
            // No conflicts — add directly
            onAddToExisting(existingOpenPO.id, items, etaStr !== '—' ? etaStr : undefined)
        } else {
            const po: PurchaseOrder = {
                id:        nextPOId,
                vendor:    vendor.trim(),
                date:      todayStr,
                eta:       etaStr,
                status:    'Draft',
                items,
                totalCost: items.reduce((s, i) => s + i.lineTotal, 0),
            }
            onSave(po)
        }
        onClose()
    }

    function handleConflictAction(idx: number, action: 'merge' | 'separate') {
        setConflictResolutions((prev) =>
            prev.map((c, i) => (i === idx ? { ...c, action } : c)),
        )
    }

    function handleConflictConfirm() {
        if (!existingOpenPO) return
        const etaStr = deliveryDate
            ? new Date(deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : undefined

        const allNewItems = buildItems()
        // Items with no conflict go through as-is
        const conflictIds = new Set(
            conflictResolutions.map((c) => `${c.newItem.inventoryId}::${c.newItem.size ?? ''}`)
        )
        const nonConflicting = allNewItems.filter(
            (item) => !conflictIds.has(`${item.inventoryId}::${item.size ?? ''}`)
        )
        // Apply resolutions
        const resolved: POLineItem[] = []
        for (const conflict of conflictResolutions) {
            if (conflict.action === 'merge') {
                // Update qty on the existing item — pass as a "merged" item with the
                // combined qty. handleAddToExistingPO will upsert based on inventoryId+size.
                resolved.push({
                    ...conflict.newItem,
                    orderQty:  conflict.existingItem.orderQty + conflict.newItem.orderQty,
                    lineTotal: (conflict.existingItem.orderQty + conflict.newItem.orderQty) * conflict.newItem.unitCost,
                    _replaceExisting: true,  // signal to page to replace, not append
                } as POLineItem & { _replaceExisting?: boolean })
            } else {
                // Add as a separate new line item
                resolved.push(conflict.newItem)
            }
        }
        onAddToExisting(existingOpenPO.id, [...nonConflicting, ...resolved], etaStr)
        onClose()
    }

    // ── Backdrop click guard ────────────────────────────────────────────────────
    const isDirty = vendor !== '' || rows.some((r) => r.selectedItem !== null || r.itemSearch !== '') || deliveryDate !== ''

    function handleBackdropClick() {
        if (isDirty) {
            if (!window.confirm('You have unsaved changes. Discard them and close?')) return
        }
        onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                            New Purchase Order
                        </p>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl font-bold text-gray-900 font-mono">
                                {addMode === 'existing' && existingOpenPO ? existingOpenPO.id : nextPOId}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full font-semibold">
                                {addMode === 'existing' ? existingOpenPO?.status : 'Draft'}
                            </span>
                        </div>
                        {/* Ref No — visible when creating a new PO (not adding to existing) */}
                        {addMode !== 'existing' && nextPOId && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Ref No.</span>
                                <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                                    {poIdToRefNo(nextPOId)}
                                </span>
                                <span className="text-[10px] text-gray-400 italic">use on supplier portal</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleBackdropClick}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Conflict resolution screen ──────────────────────────────────── */}
                {conflictStep && (
                    <>
                        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-base">⚠️</span>
                                <p className="text-sm font-semibold text-gray-800">
                                    {conflictResolutions.length} item{conflictResolutions.length !== 1 ? 's' : ''} already exist{conflictResolutions.length === 1 ? 's' : ''} in {existingOpenPO?.id}
                                </p>
                            </div>
                            <p className="text-xs text-gray-500 -mt-2">
                                Choose how to handle each duplicate. Items with different sizes are added separately automatically.
                            </p>

                            <div className="space-y-3">
                                {conflictResolutions.map((c, idx) => (
                                    <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">
                                                    {c.newItem.name}
                                                    {c.newItem.size && (
                                                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded font-semibold">
                                                            {c.newItem.size}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs font-mono text-gray-400 mt-0.5">{c.newItem.articleNumber}</p>
                                            </div>
                                            <div className="text-right text-xs text-gray-500 shrink-0">
                                                <div>In PO: <span className="font-semibold text-gray-700">×{c.existingItem.orderQty}</span></div>
                                                <div>Adding: <span className="font-semibold text-orange-600">×{c.newItem.orderQty}</span></div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleConflictAction(idx, 'merge')}
                                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                                                    c.action === 'merge'
                                                        ? 'bg-orange-500 border-orange-500 text-white'
                                                        : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-700'
                                                }`}
                                            >
                                                Increase qty to ×{c.existingItem.orderQty + c.newItem.orderQty}
                                            </button>
                                            <button
                                                onClick={() => handleConflictAction(idx, 'separate')}
                                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                                                    c.action === 'separate'
                                                        ? 'bg-blue-500 border-blue-500 text-white'
                                                        : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700'
                                                }`}
                                            >
                                                Add as separate line (×{c.newItem.orderQty})
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                            <button
                                onClick={() => setConflictStep(false)}
                                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleConflictConfirm}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                Confirm &amp; Add to PO
                            </button>
                        </div>
                    </>
                )}

                {/* Body */}
                {!conflictStep && <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

                    {/* Supplier + PO Date + Delivery Date */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-start">

                        {/* Supplier searchable dropdown */}
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5 block">
                                Supplier *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Type to search supplier…"
                                    value={vendorSearch}
                                    readOnly={!!defaultVendor}
                                    onFocus={() => !defaultVendor && setVendorOpen(true)}
                                    onBlur={() => setTimeout(() => setVendorOpen(false), 150)}
                                    onChange={(e) => {
                                        if (defaultVendor) return
                                        setVendorSearch(e.target.value)
                                        setVendor('')
                                        setVendorOpen(true)
                                    }}
                                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                                        defaultVendor
                                            ? 'bg-gray-100 text-gray-600 cursor-default'
                                            : 'bg-gray-50'
                                    }`}
                                />
                                {defaultVendor && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 select-none">
                                        🔒
                                    </span>
                                )}
                                {vendorOpen && !defaultVendor && filteredVendors.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                        {filteredVendors.map((v) => (
                                            <button
                                                key={v}
                                                onMouseDown={() => selectVendor(v)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-orange-700 transition-colors"
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PO Date (read-only, auto-set to today) */}
                        <div className="w-36">
                            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5 block">
                                PO Date
                            </label>
                            <input
                                type="text"
                                value={todayStr}
                                readOnly
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-default"
                            />
                        </div>

                        {/* Delivery Date (user picks) */}
                        <div className="w-44">
                            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5 block">
                                Expected Delivery
                            </label>
                            <input
                                type="date"
                                value={deliveryDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700"
                            />
                        </div>
                    </div>

                    {/* ── Open PO decision banner ─────────────────────────────────────── */}
                    {existingOpenPO && addMode === null && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                            <div className="flex items-start gap-3">
                                <span className="text-lg mt-0.5">📋</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-amber-800 mb-0.5">
                                        Open PO already exists for {vendor}
                                    </p>
                                    <p className="text-xs text-amber-700 mb-3">
                                        <span className="font-mono font-semibold">{existingOpenPO.id}</span>
                                        {' · '}{existingOpenPO.status}
                                        {existingOpenPO.eta && existingOpenPO.eta !== '—' ? ` · ETA ${existingOpenPO.eta}` : ''}
                                        {' · '}{existingOpenPO.items.length} item{existingOpenPO.items.length !== 1 ? 's' : ''}
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => setAddMode('existing')}
                                            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                        >
                                            Add items to existing PO
                                        </button>
                                        <button
                                            onClick={() => setAddMode('new')}
                                            className="px-4 py-1.5 bg-white hover:bg-gray-50 border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg transition-colors"
                                        >
                                            Create a separate new PO
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirmation strip once decided */}
                    {existingOpenPO && addMode !== null && (
                        <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between text-xs ${
                            addMode === 'existing'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                            <span>
                                {addMode === 'existing'
                                    ? `Items will be added to ${existingOpenPO.id}`
                                    : `Creating a new separate PO (${nextPOId})`}
                            </span>
                            <button
                                onClick={() => setAddMode(null)}
                                className="text-xs underline opacity-70 hover:opacity-100 ml-3"
                            >
                                Change
                            </button>
                        </div>
                    )}

                    {/* Items table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Items</div>
                            {!vendor && (
                                <span className="text-xs text-gray-400 italic">Select a supplier first to see their items</span>
                            )}
                            {vendor && vendorItems.length === 0 && (
                                <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                                    No items linked to this supplier — search all inventory below
                                </span>
                            )}
                            {vendor && vendorItems.length > 0 && (
                                <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                                    {vendorItems.length} item{vendorItems.length !== 1 ? 's' : ''} linked to supplier
                                </span>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-visible">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs uppercase text-gray-400 tracking-wider">
                                        <th className="px-4 py-2.5 w-8">#</th>
                                        <th className="px-4 py-2.5">Item</th>
                                        <th className="px-4 py-2.5 w-24 text-center">Qty</th>
                                        <th className="px-4 py-2.5 text-right">Unit Cost</th>
                                        <th className="px-4 py-2.5 text-right">Total</th>
                                        <th className="px-4 py-2.5 w-8" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rows.map((row, idx) => {
                                        const q = row.itemSearch.toLowerCase()
                                        // Search ALL inventory items (not just supplier-matched ones)
                                        // so items linked to slightly different vendor names still appear
                                        const filteredItems = (q ? allInventoryItems : vendorItems).filter(
                                            (item) =>
                                                !q ||
                                                item.name.toLowerCase().includes(q) ||
                                                item.articleNumber.toLowerCase().includes(q) ||
                                                item.id.toLowerCase().includes(q),
                                        ).slice(0, 8)
                                        const lineTotal = row.selectedItem ? row.qty * row.selectedItem.cost : 0

                                        return (
                                            <tr key={row.rowId}>
                                                <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>

                                                {/* Item searchable dropdown */}
                                                <td className="px-4 py-3 relative">
                                                    {row.isDefault ? (
                                                        /* Locked: pre-filled from low-stock alert */
                                                        <div className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-between gap-2">
                                                            <span className="truncate">{row.itemSearch}</span>
                                                            {row.selectedItem?.size && (
                                                                <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded font-semibold shrink-0">
                                                                    {row.selectedItem.size}
                                                                </span>
                                                            )}
                                                            <span className="text-gray-400 text-xs shrink-0">🔒</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                        <input
                                                            type="text"
                                                            placeholder={vendor ? 'Search any inventory item…' : 'Select supplier first'}
                                                            disabled={!vendor}
                                                            value={row.itemSearch}
                                                            onFocus={() => vendor && updateRow(row.rowId, { itemDropdownOpen: true })}
                                                            onBlur={() =>
                                                                setTimeout(
                                                                    () => updateRow(row.rowId, { itemDropdownOpen: false }),
                                                                    150,
                                                                )
                                                            }
                                                            onChange={(e) =>
                                                                updateRow(row.rowId, {
                                                                    itemSearch:       e.target.value,
                                                                    selectedItem:     null,
                                                                    itemDropdownOpen: true,
                                                                })
                                                            }
                                                            className={`w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                                                                !vendor ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50'
                                                            }`}
                                                        />
                                                        {row.selectedItem?.size && (
                                                            <div className="mt-1 flex items-center gap-1">
                                                                <span className="text-xs text-gray-500">Size:</span>
                                                                <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full font-semibold">
                                                                    {row.selectedItem.size}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {row.itemDropdownOpen && filteredItems.length > 0 && (
                                                            <div className="absolute left-4 right-0 z-30 top-full mt-0.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                {filteredItems.map((item) => (
                                                                    <button
                                                                        key={item.id}
                                                                        onMouseDown={() => selectItem(row.rowId, item)}
                                                                        className="w-full text-left px-3 py-2.5 hover:bg-orange-50 transition-colors"
                                                                    >
                                                                        <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                                                                            {item.name}
                                                                            {item.size && (
                                                                                <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded font-semibold">
                                                                                    {item.size}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400 font-mono mt-0.5">
                                                                            {item.articleNumber} · {item.id}
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        </>
                                                    )}
                                                </td>

                                                {/* Qty */}
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={row.qty}
                                                        onChange={(e) =>
                                                            updateRow(row.rowId, {
                                                                qty: Math.max(1, parseInt(e.target.value) || 1),
                                                            })
                                                        }
                                                        className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 text-center"
                                                    />
                                                </td>

                                                {/* Unit cost */}
                                                <td className="px-4 py-3 text-right text-gray-500 text-sm whitespace-nowrap">
                                                    {row.selectedItem ? formatCurrency(row.selectedItem.cost) : '—'}
                                                </td>

                                                {/* Line total */}
                                                <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm whitespace-nowrap">
                                                    {row.selectedItem ? formatCurrency(lineTotal) : '—'}
                                                </td>

                                                {/* Remove row */}
                                                <td className="px-4 py-3 text-center">
                                                    {!row.isDefault && (
                                                        <button
                                                            onClick={() => removeRow(row.rowId)}
                                                            title="Remove row"
                                                            className="w-6 h-6 rounded-md hover:bg-red-100 text-gray-300 hover:text-red-500 flex items-center justify-center text-xs transition-colors mx-auto"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                                        <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                                            Grand Total
                                        </td>
                                        <td className="px-4 py-3 text-right text-base font-bold text-gray-900 whitespace-nowrap">
                                            {formatCurrency(grandTotal)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Add item row button */}
                        <button
                            onClick={addRow}
                            className="mt-3 flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
                        >
                            <span className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold">
                                +
                            </span>
                            Add Item
                        </button>
                    </div>
                </div>}

                {/* Footer — hidden during conflict step (it has its own footer) */}
                {!conflictStep && <>
                <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        {addMode === 'existing'
                            ? <span>Items will be appended to <span className="font-semibold text-gray-600">{existingOpenPO?.id}</span></span>
                            : <span>PO will be saved as <span className="font-semibold text-gray-600">Draft</span></span>
                        }
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleBackdropClick}
                            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit || needsDecision}
                            title={needsDecision ? 'Choose to add to existing PO or create new one above' : undefined}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            {addMode === 'existing' ? 'Add to PO' : 'Create PO'}
                        </button>
                    </div>
                </div></>}
            </div>
        </div>
    )
}
