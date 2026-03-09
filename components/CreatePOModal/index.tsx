'use client'

import { useState, useMemo } from 'react'
import { vendorDetails } from '@/data/vendors'
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
// The new PO is saved as Draft.

export function CreatePOModal({
    nextPOId,
    allInventoryItems,
    onSave,
    onClose,
}: {
    nextPOId:          string
    allInventoryItems: FlatInventoryItem[]
    onSave:            (po: PurchaseOrder) => void
    onClose:           () => void
}) {
    const todayStr   = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const allVendors = useMemo(() => Object.keys(vendorDetails).sort(), [])

    const [vendorSearch,  setVendorSearch]  = useState('')
    const [vendor,        setVendor]        = useState('')
    const [vendorOpen,    setVendorOpen]    = useState(false)
    const [rows,          setRows]          = useState<DraftRow[]>([emptyRow(), emptyRow(), emptyRow()])
    const [deliveryDate,  setDeliveryDate]  = useState('')

    // Items belonging to the selected supplier
    const vendorItems = useMemo(
        () => vendor ? allInventoryItems.filter((i) => i.vendor === vendor) : [],
        [vendor, allInventoryItems],
    )

    const filteredVendors = vendorSearch
        ? allVendors.filter((v) => v.toLowerCase().includes(vendorSearch.toLowerCase()))
        : allVendors

    function selectVendor(v: string) {
        setVendor(v)
        setVendorSearch(v)
        setVendorOpen(false)
        setRows([emptyRow(), emptyRow(), emptyRow()])
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

    function handleSubmit() {
        if (!canSubmit) return
        const validRows = rows.filter((r) => r.selectedItem && r.qty > 0)
        const items: POLineItem[] = validRows.map((r) => ({
            inventoryId:   r.selectedItem!.id,
            name:          r.selectedItem!.name,
            articleNumber: r.selectedItem!.articleNumber,
            orderQty:      r.qty,
            unitCost:      r.selectedItem!.cost,
            lineTotal:     r.qty * r.selectedItem!.cost,
            size:          r.selectedItem!.size,
        }))
        const etaStr = deliveryDate
            ? new Date(deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'
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
        onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
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
                            <span className="text-2xl font-bold text-gray-900 font-mono">{nextPOId}</span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full font-semibold">
                                Draft
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

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
                                    onFocus={() => setVendorOpen(true)}
                                    onBlur={() => setTimeout(() => setVendorOpen(false), 150)}
                                    onChange={(e) => {
                                        setVendorSearch(e.target.value)
                                        setVendor('')
                                        setVendorOpen(true)
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                                {vendorOpen && filteredVendors.length > 0 && (
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

                    {/* Items table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Items</div>
                            {!vendor && (
                                <span className="text-xs text-gray-400 italic">Select a supplier first to see their items</span>
                            )}
                            {vendor && vendorItems.length === 0 && (
                                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                    ⚠ No inventory items found for this supplier
                                </span>
                            )}
                            {vendor && vendorItems.length > 0 && (
                                <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                                    {vendorItems.length} item{vendorItems.length !== 1 ? 's' : ''} available
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
                                        const filteredItems = vendorItems.filter(
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
                                                    <input
                                                        type="text"
                                                        placeholder={vendor ? 'Search item…' : 'Select supplier first'}
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
                                                    {row.itemDropdownOpen && filteredItems.length > 0 && (
                                                        <div className="absolute left-4 right-0 z-30 top-full mt-0.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {filteredItems.map((item) => (
                                                                <button
                                                                    key={item.id}
                                                                    onMouseDown={() => selectItem(row.rowId, item)}
                                                                    className="w-full text-left px-3 py-2.5 hover:bg-orange-50 transition-colors"
                                                                >
                                                                    <div className="text-sm font-medium text-gray-800">{item.name}</div>
                                                                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                                                                        {item.articleNumber} · {item.id}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
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
                                                    <button
                                                        onClick={() => removeRow(row.rowId)}
                                                        title="Remove row"
                                                        className="w-6 h-6 rounded-md hover:bg-red-100 text-gray-300 hover:text-red-500 flex items-center justify-center text-xs transition-colors mx-auto"
                                                    >
                                                        ✕
                                                    </button>
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
                </div>

                {/* Footer */}
                <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        PO will be saved as <span className="font-semibold text-gray-600">Draft</span>
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            Create PO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
