// Shared types, form data helpers, and reusable form field components
// used by both AddSupplierModal and SupplierDetailModal.

import type { ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupplierRow {
    supplierNumber:          string
    name:                    string
    address:                 string
    phone:                   string
    orgNumber:               string
    itemCount:               number
    categories:              string[]
    lowStockCount:           number
    hasDetails:              boolean
    email?:                  string
    contactPerson?:          string
    bankName?:               string
    bankAccount?:            string
    bankIBAN?:               string
    bankSwift?:              string
    isManual?:               boolean
    freeShippingThreshold?:  number
}

export interface SupplierFormData {
    name:                  string
    address:               string
    phone:                 string
    email:                 string
    orgNumber:             string
    contactPerson:         string
    bankName:              string
    bankAccount:           string
    bankIBAN:              string
    bankSwift:             string
    freeShippingThreshold: string
}

export const CATEGORY_STYLE: Record<string, string> = {
    'Motorcycles': 'bg-orange-100 text-orange-700',
    'Spare Parts': 'bg-blue-100 text-blue-700',
    'Accessories': 'bg-purple-100 text-purple-700',
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

export function emptyFormData(): SupplierFormData {
    return {
        name: '', address: '', phone: '', email: '',
        orgNumber: '', contactPerson: '',
        bankName: '', bankAccount: '', bankIBAN: '', bankSwift: '',
        freeShippingThreshold: '',
    }
}

export function supplierToFormData(s: SupplierRow): SupplierFormData {
    const d = (v?: string) => (v === '—' || !v ? '' : v)
    return {
        name:                  d(s.name),
        address:               d(s.address),
        phone:                 d(s.phone),
        email:                 d(s.email),
        orgNumber:             d(s.orgNumber),
        contactPerson:         d(s.contactPerson),
        bankName:              d(s.bankName),
        bankAccount:           d(s.bankAccount),
        bankIBAN:              d(s.bankIBAN),
        bankSwift:             d(s.bankSwift),
        freeShippingThreshold: s.freeShippingThreshold != null ? String(s.freeShippingThreshold) : '',
    }
}

// ─── Reusable form field components ──────────────────────────────────────────

export function Field({
    label, value, onChange, placeholder, type = 'text', required = false, span = false,
}: {
    label: string; value: string; onChange: (v: string) => void
    placeholder?: string; type?: string; required?: boolean; span?: boolean
}) {
    return (
        <div className={span ? 'col-span-2' : ''}>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5 block">
                {label}{required && <span className="text-orange-500 ml-0.5">*</span>}
            </label>
            <input
                type={type} value={value} placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800 placeholder:text-gray-300"
            />
        </div>
    )
}

export function TextAreaField({
    label, value, onChange, placeholder, required = false,
}: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
    return (
        <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5 block">
                {label}{required && <span className="text-orange-500 ml-0.5">*</span>}
            </label>
            <textarea value={value} placeholder={placeholder} rows={2}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800 placeholder:text-gray-300 resize-none"
            />
        </div>
    )
}

export function SectionHeading({ children }: { children: ReactNode }) {
    return (
        <div className="col-span-2 flex items-center gap-3 pt-1">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{children}</span>
            <div className="flex-1 border-t border-gray-100" />
        </div>
    )
}

export function InfoField({ label, value, span = false }: { label: string; value?: string; span?: boolean }) {
    const empty = !value || value === '—'
    return (
        <div className={span ? 'col-span-2' : ''}>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">{label}</div>
            <div className={`text-sm ${empty ? 'text-gray-300 italic' : 'text-gray-700'}`}>
                {empty ? 'Not provided' : value}
            </div>
        </div>
    )
}

// ─── Supplier form body (shared between create and edit modals) ───────────────

export function SupplierFormBody({
    form, setField, allRequired = false,
}: {
    form:         SupplierFormData
    setField:     (key: keyof SupplierFormData, value: string) => void
    allRequired?: boolean
}) {
    const r = allRequired
    return (
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <SectionHeading>Basic Information</SectionHeading>
            <Field label="Supplier Name" value={form.name} onChange={(v) => setField('name', v)}
                placeholder="e.g. Yamaha Motor Co., Ltd." required span />

            <SectionHeading>Contact Details</SectionHeading>
            <TextAreaField label="Address" value={form.address} onChange={(v) => setField('address', v)}
                placeholder="Street, City, Postcode, Country" required={r} />
            <Field label="Phone Number" value={form.phone} onChange={(v) => setField('phone', v)}
                placeholder="+1 234 567 8900" type="tel" required={r} />
            <Field label="Email Address" value={form.email} onChange={(v) => setField('email', v)}
                placeholder="contact@supplier.com" type="email" required={r} />
            <Field label="Contact Person" value={form.contactPerson} onChange={(v) => setField('contactPerson', v)}
                placeholder="Full name" span required={r} />

            <SectionHeading>Business Details</SectionHeading>
            <Field label="Organisation Number" value={form.orgNumber} onChange={(v) => setField('orgNumber', v)}
                placeholder="e.g. 556000-1234" span required={r} />

            <SectionHeading>Bank Details</SectionHeading>
            <Field label="Bank Name" value={form.bankName} onChange={(v) => setField('bankName', v)}
                placeholder="e.g. HSBC Bank" span required={r} />
            <Field label="Account Number" value={form.bankAccount} onChange={(v) => setField('bankAccount', v)}
                placeholder="e.g. 1234567890" required={r} />
            <Field label="IBAN" value={form.bankIBAN} onChange={(v) => setField('bankIBAN', v)}
                placeholder="e.g. GB29NWBK60161331926819" required={r} />
            <Field label="SWIFT / BIC" value={form.bankSwift} onChange={(v) => setField('bankSwift', v)}
                placeholder="e.g. MIDLGB22" required={r} />

            <SectionHeading>Shipping</SectionHeading>
            <Field label="Free Shipping Threshold (SEK)" value={form.freeShippingThreshold}
                onChange={(v) => setField('freeShippingThreshold', v)}
                placeholder="e.g. 500"
                type="number" span required={r} />
        </div>
    )
}
