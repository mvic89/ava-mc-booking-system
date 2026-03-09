'use client'

import { useState } from 'react'
import {
    SupplierRow,
    SupplierFormData,
    supplierToFormData,
    SupplierFormBody,
    SectionHeading,
    InfoField,
    CATEGORY_STYLE,
} from '@/components/SupplierFormShared'

// ─── Supplier Detail Modal ────────────────────────────────────────────────────
// Opens when a supplier row is clicked. Shows supplier info in read-only view
// or switches to edit mode when the user clicks "Edit".

export function SupplierDetailModal({
    supplier,
    onEdit,
    onShowPOs,
    onClose,
}: {
    supplier:  SupplierRow
    onEdit:    (updates: Partial<SupplierRow>) => void
    onShowPOs: () => void
    onClose:   () => void
}) {
    const [editMode, setEditMode] = useState(false)
    const [form, setForm]         = useState<SupplierFormData>(() => supplierToFormData(supplier))

    function setField(key: keyof SupplierFormData, value: string) {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    function handleSaveEdit() {
        const or = (v: string) => v.trim() || '—'
        onEdit({
            name:                  form.name.trim() || supplier.name,
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
            hasDetails:            true,
        })
        setEditMode(false)
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
                <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                                Supplier
                            </span>
                            {supplier.isManual && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                                    Manual
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl font-bold text-gray-900 font-mono">
                                {supplier.supplierNumber}
                            </span>
                        </div>
                        <div className="text-base font-semibold text-gray-700 mt-0.5">{supplier.name}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-1">
                        {!editMode && (
                            <button
                                onClick={() => setEditMode(true)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                ✏️ Edit
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-7 py-5">
                    {editMode ? (
                        <SupplierFormBody form={form} setField={setField} />
                    ) : (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                            <SectionHeading>Contact Details</SectionHeading>
                            <InfoField label="Address"        value={supplier.address}       span />
                            <InfoField label="Phone Number"   value={supplier.phone} />
                            <InfoField label="Email Address"  value={supplier.email} />
                            <InfoField label="Contact Person" value={supplier.contactPerson} span />

                            <SectionHeading>Business Details</SectionHeading>
                            <InfoField label="Organisation Number" value={supplier.orgNumber} span />

                            <SectionHeading>Bank Details</SectionHeading>
                            <InfoField label="Bank Name"      value={supplier.bankName}    span />
                            <InfoField label="Account Number" value={supplier.bankAccount} />
                            <InfoField label="IBAN"           value={supplier.bankIBAN} />
                            <InfoField label="SWIFT / BIC"    value={supplier.bankSwift} />

                            <SectionHeading>Shipping</SectionHeading>
                            <InfoField
                                label="Free Shipping Threshold"
                                value={supplier.freeShippingThreshold != null
                                    ? `SEK ${supplier.freeShippingThreshold.toLocaleString()}`
                                    : undefined}
                                span
                            />

                            <SectionHeading>Inventory</SectionHeading>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">
                                    SKUs Supplied
                                </div>
                                <div className="text-sm font-bold text-gray-800">{supplier.itemCount}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5">
                                    Categories
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {supplier.categories.length > 0
                                        ? supplier.categories.map((cat) => (
                                            <span
                                                key={cat}
                                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[cat] ?? 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {cat}
                                            </span>
                                          ))
                                        : <span className="text-sm text-gray-300 italic">None</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    {editMode ? (
                        <>
                            <button
                                onClick={() => { setEditMode(false); setForm(supplierToFormData(supplier)) }}
                                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!form.name.trim()}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                Save Changes
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={onShowPOs}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                            >
                                📦 Show POs
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
