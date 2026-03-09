'use client'

import { useState } from 'react'
import {
    SupplierRow,
    SupplierFormData,
    emptyFormData,
    SupplierFormBody,
} from '@/components/SupplierFormShared'

// ─── Add Supplier Modal ───────────────────────────────────────────────────────
// Shown when the user clicks "+ Add Supplier" on the Suppliers page.
// Collects all supplier fields and calls onSave with the new SupplierRow.

export function AddSupplierModal({
    supplierNumber,
    onSave,
    onClose,
}: {
    supplierNumber: string
    onSave:         (s: SupplierRow) => void
    onClose:        () => void
}) {
    const [form, setForm] = useState<SupplierFormData>(emptyFormData)

    function setField(key: keyof SupplierFormData, value: string) {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const canSubmit = form.name.trim() !== ''

    function handleSave() {
        if (!canSubmit) return
        const or = (v: string) => v.trim() || '—'
        const s: SupplierRow = {
            supplierNumber,
            name:                  form.name.trim(),
            address:               or(form.address),
            phone:                 or(form.phone),
            orgNumber:             or(form.orgNumber),
            email:                 or(form.email),
            contactPerson:         or(form.contactPerson),
            bankName:              or(form.bankName),
            bankAccount:           or(form.bankAccount),
            bankIBAN:              or(form.bankIBAN),
            bankSwift:             or(form.bankSwift),
            freeShippingThreshold: form.freeShippingThreshold ? Number(form.freeShippingThreshold) : undefined,
            itemCount:             0,
            categories:            [],
            lowStockCount:         0,
            hasDetails:            true,
            isManual:              true,
        }
        onSave(s)
        onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                            New Supplier
                        </p>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl font-bold text-gray-900 font-mono">{supplierNumber}</span>
                            <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full font-semibold">
                                Auto Reference
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
                <div className="flex-1 overflow-y-auto px-7 py-5">
                    <SupplierFormBody form={form} setField={setField} />
                </div>

                {/* Footer */}
                <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        Reference <span className="font-semibold text-gray-600">{supplierNumber}</span> is auto-assigned
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!canSubmit}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            Save Supplier
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
