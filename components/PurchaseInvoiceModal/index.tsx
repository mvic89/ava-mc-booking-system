'use client'

import { useState } from 'react'
import { vendorDetails } from '@/data/vendors'
import { PurchaseInvoice, PurchaseInvoiceStatus } from '@/utils/types'
import { formatCurrency } from '@/components/POModal'

// ─── Status styles ────────────────────────────────────────────────────────────

export const PINV_STATUS_STYLE: Record<PurchaseInvoiceStatus, { dot: string; badge: string }> = {
    'Pending':  { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    'Paid':     { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700' },
    'Overdue':  { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border border-red-200' },
    'Disputed': { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700' },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    invoice?: PurchaseInvoice | null   // null = create new
    poIds: string[]                    // list of available PO IDs for linking
    onClose: () => void
    onSave: (inv: PurchaseInvoice) => void
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

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
const SELECT = INPUT + ' bg-white'

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchaseInvoiceModal({ invoice, poIds, onClose, onSave, onDelete }: Props) {
    const isNew = !invoice

    const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(invoice?.supplierInvoiceNumber ?? '')
    const [poId,                  setPoId                 ] = useState(invoice?.poId ?? '')
    const [vendor,                setVendor               ] = useState(invoice?.vendor ?? '')
    const [invoiceDate,           setInvoiceDate          ] = useState(invoice?.invoiceDate ?? new Date().toISOString().slice(0, 10))
    const [dueDate,               setDueDate              ] = useState(invoice?.dueDate ?? '')
    const [amount,                setAmount               ] = useState(invoice?.amount ?? 0)
    const [status,                setStatus               ] = useState<PurchaseInvoiceStatus>(invoice?.status ?? 'Pending')
    const [notes,                 setNotes                ] = useState(invoice?.notes ?? '')
    const [confirmDelete,         setConfirmDelete        ] = useState(false)

    const vendorNames = Object.keys(vendorDetails).sort()
    const isLocked = !isNew && (status === 'Paid')

    function handleSave() {
        if (!supplierInvoiceNumber.trim() || !vendor || !invoiceDate || !dueDate || amount <= 0) return
        onSave({
            id:                    invoice?.id ?? '',   // page generates ID for new invoices
            supplierInvoiceNumber: supplierInvoiceNumber.trim(),
            poId:                  poId || undefined,
            vendor,
            invoiceDate,
            dueDate,
            amount,
            status,
            notes: notes.trim() || undefined,
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">
                            {isNew ? 'Record Purchase Invoice' : `Invoice ${invoice!.id}`}
                        </h2>
                        {!isNew && (
                            <p className="text-xs text-gray-400 mt-0.5">Supplier invoice from {invoice!.vendor}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 flex flex-col gap-4">

                    {/* Supplier Invoice Number */}
                    <Field label="Supplier Invoice Number *">
                        <input
                            className={INPUT}
                            value={supplierInvoiceNumber}
                            onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                            placeholder="e.g. INV-2026-0042"
                            disabled={isLocked}
                        />
                    </Field>

                    {/* Vendor */}
                    <Field label="Vendor / Supplier *">
                        <select
                            className={SELECT}
                            value={vendor}
                            onChange={(e) => setVendor(e.target.value)}
                            disabled={isLocked}
                        >
                            <option value="">— select vendor —</option>
                            {vendorNames.map((v) => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </Field>

                    {/* PO Link */}
                    <Field label="Linked Purchase Order">
                        <select
                            className={SELECT}
                            value={poId}
                            onChange={(e) => setPoId(e.target.value)}
                            disabled={isLocked}
                        >
                            <option value="">— none —</option>
                            {poIds.map((id) => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                    </Field>

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

                    {/* Amount */}
                    <Field label="Amount (SEK) *">
                        <input
                            type="number"
                            min={0}
                            className={INPUT}
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            disabled={isLocked}
                        />
                    </Field>

                    {/* Status */}
                    <Field label="Status">
                        <select
                            className={SELECT}
                            value={status}
                            onChange={(e) => setStatus(e.target.value as PurchaseInvoiceStatus)}
                        >
                            {(['Pending', 'Paid', 'Overdue', 'Disputed'] as PurchaseInvoiceStatus[]).map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </Field>

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

                    {/* Amount preview */}
                    {amount > 0 && (
                        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm flex justify-between">
                            <span className="text-gray-500">Invoice Total</span>
                            <span className="font-bold text-gray-800">{formatCurrency(amount)}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex items-center justify-between gap-3">
                    {/* Delete */}
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

                    {/* Cancel / Save */}
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={!supplierInvoiceNumber.trim() || !vendor || !invoiceDate || !dueDate || amount <= 0}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >{isNew ? 'Record Invoice' : 'Save Changes'}</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
