'use client'

import { useState } from 'react'
import { useInventory } from '@/context/InventoryContext'
import { SalesInvoice, SalesInvoiceItem, SalesInvoiceStatus } from '@/utils/types'
import { formatCurrency } from '@/components/POModal'

// ─── Status styles ────────────────────────────────────────────────────────────

export const SINV_STATUS_STYLE: Record<SalesInvoiceStatus, { dot: string; badge: string }> = {
    'Draft':   { dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600' },
    'Sent':    { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700' },
    'Paid':    { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700' },
    'Overdue': { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border border-red-200' },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    invoice?: SalesInvoice | null   // null = create new
    onClose: () => void
    onSave: (inv: SalesInvoice) => void
    onDelete?: (id: string) => void
}

// ─── Field row helper ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
            {children}
        </div>
    )
}

const INPUT  = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
const SELECT = INPUT + ' bg-white'

// ─── Line item editor ─────────────────────────────────────────────────────────

function LineItemRow({
    item,
    idx,
    onUpdate,
    onRemove,
    disabled,
}: {
    item: SalesInvoiceItem
    idx: number
    onUpdate: (idx: number, patch: Partial<SalesInvoiceItem>) => void
    onRemove: (idx: number) => void
    disabled: boolean
}) {
    return (
        <div className="grid grid-cols-[1fr_60px_80px_24px] gap-2 items-start py-2 border-b border-gray-100 last:border-0">
            <div className="flex flex-col gap-1">
                <input
                    className={INPUT}
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => onUpdate(idx, { name: e.target.value })}
                    disabled={disabled}
                />
                {item.size !== undefined && (
                    <input
                        className={INPUT + ' text-xs'}
                        placeholder="Size (e.g. M, 42)"
                        value={item.size}
                        onChange={(e) => onUpdate(idx, { size: e.target.value })}
                        disabled={disabled}
                    />
                )}
            </div>
            <input
                type="number"
                min={1}
                className={INPUT + ' text-center'}
                value={item.quantity}
                onChange={(e) => {
                    const qty = Math.max(1, Number(e.target.value))
                    onUpdate(idx, { quantity: qty, lineTotal: qty * item.unitPrice })
                }}
                disabled={disabled}
            />
            <input
                type="number"
                min={0}
                className={INPUT}
                value={item.unitPrice}
                onChange={(e) => {
                    const price = Number(e.target.value)
                    onUpdate(idx, { unitPrice: price, lineTotal: item.quantity * price })
                }}
                disabled={disabled}
            />
            {!disabled && (
                <button
                    onClick={() => onRemove(idx)}
                    className="text-gray-300 hover:text-red-500 text-lg leading-none mt-1.5"
                >✕</button>
            )}
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesInvoiceModal({ invoice, onClose, onSave, onDelete }: Props) {
    const isNew = !invoice
    const { motorcycles, spareParts, accessories } = useInventory()

    // All inventory items flattened for quick-add
    const allInventory = [
        ...motorcycles.map((m) => ({ id: m.id, name: m.name, articleNumber: m.articleNumber, price: m.sellingPrice, size: undefined as string | undefined })),
        ...spareParts.map((s)  => ({ id: s.id, name: s.name, articleNumber: s.articleNumber, price: s.sellingPrice, size: undefined as string | undefined })),
        ...accessories.map((a) => ({ id: a.id, name: a.name, articleNumber: a.articleNumber, price: a.sellingPrice, size: a.size ?? '' })),
    ]

    const [customerName,  setCustomerName ] = useState(invoice?.customerName  ?? '')
    const [customerEmail, setCustomerEmail] = useState(invoice?.customerEmail ?? '')
    const [customerPhone, setCustomerPhone] = useState(invoice?.customerPhone ?? '')
    const [invoiceDate,   setInvoiceDate  ] = useState(invoice?.invoiceDate   ?? new Date().toISOString().slice(0, 10))
    const [dueDate,       setDueDate      ] = useState(invoice?.dueDate       ?? '')
    const [status,        setStatus       ] = useState<SalesInvoiceStatus>(invoice?.status ?? 'Draft')
    const [notes,         setNotes        ] = useState(invoice?.notes         ?? '')
    const [items,         setItems        ] = useState<SalesInvoiceItem[]>(invoice?.items ?? [])
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [quickAdd,      setQuickAdd     ] = useState('')

    const isLocked = !isNew && status === 'Paid'
    const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0)

    function updateItem(idx: number, patch: Partial<SalesInvoiceItem>) {
        setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
    }

    function removeItem(idx: number) {
        setItems((prev) => prev.filter((_, i) => i !== idx))
    }

    function addBlankLine() {
        setItems((prev) => [...prev, { name: '', quantity: 1, unitPrice: 0, lineTotal: 0 }])
    }

    function addFromInventory(inventoryId: string) {
        const inv = allInventory.find((i) => i.id === inventoryId)
        if (!inv) return
        setItems((prev) => [...prev, {
            inventoryId:   inv.id,
            name:          inv.name,
            articleNumber: inv.articleNumber,
            quantity:      1,
            unitPrice:     inv.price,
            lineTotal:     inv.price,
            size:          inv.size !== undefined ? inv.size : undefined,
        }])
        setQuickAdd('')
    }

    function handleSave() {
        if (!customerName.trim() || !invoiceDate || !dueDate) return
        onSave({
            id:            invoice?.id ?? '',
            customerName:  customerName.trim(),
            customerEmail: customerEmail.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            invoiceDate,
            dueDate,
            totalAmount,
            status,
            notes:  notes.trim() || undefined,
            items,
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">
                            {isNew ? 'Create Sales Invoice' : `Invoice ${invoice!.id}`}
                        </h2>
                        {!isNew && (
                            <p className="text-xs text-gray-400 mt-0.5">Customer: {invoice!.customerName}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 flex flex-col gap-4">

                    {/* Customer */}
                    <Field label="Customer Name *">
                        <input
                            className={INPUT}
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Full name"
                            disabled={isLocked}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Email">
                            <input
                                type="email"
                                className={INPUT}
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                                placeholder="customer@email.com"
                                disabled={isLocked}
                            />
                        </Field>
                        <Field label="Phone">
                            <input
                                className={INPUT}
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                placeholder="+46 70 000 0000"
                                disabled={isLocked}
                            />
                        </Field>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Invoice Date *">
                            <input
                                type="date"
                                className={INPUT}
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                disabled={isLocked}
                            />
                        </Field>
                        <Field label="Due Date *">
                            <input
                                type="date"
                                className={INPUT}
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                disabled={isLocked}
                            />
                        </Field>
                    </div>

                    {/* Status */}
                    <Field label="Status">
                        <select
                            className={SELECT}
                            value={status}
                            onChange={(e) => setStatus(e.target.value as SalesInvoiceStatus)}
                        >
                            {(['Draft', 'Sent', 'Paid', 'Overdue'] as SalesInvoiceStatus[]).map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </Field>

                    {/* Line Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Line Items</span>
                            <span className="text-xs text-gray-400 grid-cols-[1fr_60px_80px] hidden sm:grid gap-2 pr-6">
                                <span>Name</span><span className="text-center">Qty</span><span>Price</span>
                            </span>
                        </div>

                        {items.length === 0 && (
                            <p className="text-xs text-gray-400 py-3 text-center">No items yet — add from inventory or add a custom line.</p>
                        )}

                        {items.map((item, idx) => (
                            <LineItemRow
                                key={idx}
                                item={item}
                                idx={idx}
                                onUpdate={updateItem}
                                onRemove={removeItem}
                                disabled={isLocked}
                            />
                        ))}

                        {/* Quick-add from inventory */}
                        {!isLocked && (
                            <div className="flex gap-2 mt-3">
                                <select
                                    className={SELECT + ' flex-1'}
                                    value={quickAdd}
                                    onChange={(e) => addFromInventory(e.target.value)}
                                >
                                    <option value="">+ Add from inventory...</option>
                                    <optgroup label="Motorcycles">
                                        {motorcycles.map((m) => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Spare Parts">
                                        {spareParts.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Accessories">
                                        {accessories.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <button
                                    onClick={addBlankLine}
                                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                                >+ Custom line</button>
                            </div>
                        )}

                        {/* Total */}
                        {items.length > 0 && (
                            <div className="mt-3 bg-gray-50 rounded-xl px-4 py-3 flex justify-between text-sm">
                                <span className="text-gray-500">Invoice Total</span>
                                <span className="font-bold text-gray-800">{formatCurrency(totalAmount)}</span>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <Field label="Notes">
                        <textarea
                            className={INPUT + ' resize-none'}
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes..."
                        />
                    </Field>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex items-center justify-between gap-3">
                    {!isNew && onDelete && (
                        confirmDelete ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-red-600">Delete this invoice?</span>
                                <button
                                    onClick={() => onDelete(invoice!.id)}
                                    className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600"
                                >Yes, delete</button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >Cancel</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="text-xs text-red-400 hover:text-red-600"
                            >Delete</button>
                        )
                    )}

                    {!(!isNew && onDelete) && <div />}

                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={!customerName.trim() || !invoiceDate || !dueDate}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >{isNew ? 'Create Invoice' : 'Save Changes'}</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
