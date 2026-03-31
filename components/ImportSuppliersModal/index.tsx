'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { getDealershipId, tagFromName, getDealershipTag } from '@/lib/tenant'
import type { SupplierRow } from '@/components/SupplierFormShared'

// ─── Column map (Excel header → SupplierRow field) ────────────────────────────

const SUPPLIER_COLS: Record<string, keyof SupplierRow | 'website'> = {
    'supplier name':           'name',
    'name':                    'name',
    'address':                 'address',
    'phone':                   'phone',
    'email':                   'email',
    'org number':              'orgNumber',
    'org no':                  'orgNumber',
    'organisation number':     'orgNumber',
    'contact person':          'contactPerson',
    'contact':                 'contactPerson',
    'bank account':            'bankAccount',
    'account number':          'bankAccount',
    'bank name':               'bankName',
    'bank':                    'bankName',
    'website':                 'website',
    'free shipping threshold': 'freeShippingThreshold',
    'free shipping':           'freeShippingThreshold',
    'shipping threshold':      'freeShippingThreshold',
    'categories':              'categories',
    'category':                'categories',
}

type ParsedSupplier = Partial<SupplierRow> & { website?: string; _rowNum: number }

type ImportSummary = {
    added:  number
    errors: string[]
}

// ─── Parse one sheet of rows into supplier objects ────────────────────────────

function parseRows(rows: Record<string, unknown>[]): { suppliers: ParsedSupplier[]; errors: string[] } {
    const suppliers: ParsedSupplier[] = []
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2  // 1-indexed + header
        const parsed: ParsedSupplier = { _rowNum: rowNum }

        for (const [rawKey, val] of Object.entries(row)) {
            const key = rawKey.trim().toLowerCase()
            const field = SUPPLIER_COLS[key]
            if (!field || val === undefined || val === null || val === '') continue

            const str = String(val).trim()
            if (field === 'freeShippingThreshold') {
                const n = Number(str.replace(/[^0-9.]/g, ''))
                if (!isNaN(n)) (parsed as any)[field] = n
            } else if (field === 'categories') {
                // Could be comma-separated string like "Motorcycles, Spare Parts"
                const cats = str.split(/[,;|]/).map((c) => c.trim()).filter(Boolean)
                parsed.categories = cats
            } else {
                (parsed as any)[field] = str
            }
        }

        if (!parsed.name) {
            errors.push(`Row ${rowNum}: missing Supplier Name — skipped`)
            continue
        }
        suppliers.push(parsed)
    }

    return { suppliers, errors }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportSuppliersModal({
    nextSupplierNumber,
    existingCount,
    dealershipName,
    onImported,
    onClose,
}: {
    nextSupplierNumber: string
    existingCount:      number
    dealershipName?:    string | null
    onImported:         (newSuppliers: SupplierRow[]) => void
    onClose:            () => void
}) {
    const [dragging,  setDragging]  = useState(false)
    const [fileName,  setFileName]  = useState('')
    const [preview,   setPreview]   = useState<ParsedSupplier[]>([])
    const [parseErrors, setParseErrors] = useState<string[]>([])
    const [importing, setImporting] = useState(false)
    const [summary,   setSummary]   = useState<ImportSummary | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    // ── Parse Excel / CSV file ────────────────────────────────────────────────
    const processFile = useCallback((file: File) => {
        setFileName(file.name)
        setPreview([])
        setParseErrors([])
        setSummary(null)

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer)
                const wb   = XLSX.read(data, { type: 'array' })

                // Try sheet named "Suppliers" first, otherwise use first sheet
                const sheetName = wb.SheetNames.find((n) =>
                    n.toLowerCase().includes('supplier')
                ) ?? wb.SheetNames[0]

                const ws   = wb.Sheets[sheetName]
                const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

                const { suppliers, errors } = parseRows(rows)
                setPreview(suppliers)
                setParseErrors(errors)
            } catch (err) {
                setParseErrors([`Failed to read file: ${String(err)}`])
            }
        }
        reader.readAsArrayBuffer(file)
    }, [])

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) processFile(file)
    }

    // ── Download template ─────────────────────────────────────────────────────
    function downloadTemplate() {
        const headers = [
            'Supplier Name', 'Email', 'Address', 'Phone', 'Org Number',
            'Contact Person', 'Bank Account', 'Bank Name',
            'Website', 'Free Shipping Threshold', 'Categories',
        ]
        const example = [
            'ABC Motors AB', 'contact@abcmotors.se', 'Storgatan 1, 111 22 Stockholm',
            '+46 8 123 4567', '556123-4567', 'Anna Johansson',
            'SE1234567890', 'Handelsbanken',
            'www.abcmotors.se', '5000', 'Motorcycles, Spare Parts',
        ]
        const ws = XLSX.utils.aoa_to_sheet([headers, example])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
        XLSX.writeFile(wb, 'suppliers_template.xlsx')
    }

    // ── Import to Supabase ────────────────────────────────────────────────────
    async function handleImport() {
        if (preview.length === 0) return
        setImporting(true)

        const dealershipId = getDealershipId()
        const tag = dealershipName ? tagFromName(dealershipName) : getDealershipTag()
        const fp  = (dealershipId ?? '').replace(/-/g, '').substring(0, 4).toUpperCase() || 'XXXX'
        const errors: string[] = [...parseErrors]
        const imported: SupplierRow[] = []

        for (let i = 0; i < preview.length; i++) {
            const s = preview[i]
            const supplierNumber = `SUP-${tag}-${fp}-${String(existingCount + i + 1).padStart(3, '0')}`

            const row = {
                name:                    s.name!,
                dealership_id:           dealershipId,
                address:                 s.address               ?? '—',
                phone:                   s.phone                 ?? '—',
                email:                   s.email                 ?? null,
                org_number:              s.orgNumber             ?? '—',
                contact_person:          s.contactPerson         ?? null,
                bank_account:            s.bankAccount           ?? null,
                bank_name:               s.bankName              ?? null,
                website:                 (s as any).website      ?? null,
                free_shipping_threshold: s.freeShippingThreshold ?? null,
                supplier_number:         supplierNumber,
                categories:              s.categories            ?? [],
                is_manual:               true,
            }

            const { error } = await supabase
                .from('vendors')
                .upsert(row, { onConflict: 'name,dealership_id' })

            if (error) {
                errors.push(`Row ${s._rowNum} (${s.name}): ${error.message}`)
            } else {
                imported.push({
                    supplierNumber,
                    name:                  s.name!,
                    address:               s.address               ?? '—',
                    phone:                 s.phone                 ?? '—',
                    orgNumber:             s.orgNumber             ?? '—',
                    email:                 s.email,
                    contactPerson:         s.contactPerson,
                    bankAccount:           s.bankAccount,
                    bankName:              s.bankName,
                    freeShippingThreshold: s.freeShippingThreshold,
                    categories:            s.categories ?? [],
                    itemCount:             0,
                    lowStockCount:         0,
                    hasDetails:            true,
                    isManual:              true,
                })
            }
        }

        setSummary({ added: imported.length, errors })
        if (imported.length > 0) onImported(imported)
        setImporting(false)
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                            Bulk Import
                        </p>
                        <h2 className="text-xl font-bold text-gray-900">Import Suppliers</h2>
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

                    {/* Success screen */}
                    {summary ? (
                        <div className="text-center py-8">
                            <div className="text-5xl mb-4">
                                {summary.errors.length === 0 ? '✅' : '⚠️'}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {summary.added} supplier{summary.added !== 1 ? 's' : ''} imported
                            </h3>
                            {summary.errors.length > 0 && (
                                <div className="mt-4 text-left bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                                        {summary.errors.length} error{summary.errors.length !== 1 ? 's' : ''}
                                    </p>
                                    {summary.errors.map((e, i) => (
                                        <p key={i} className="text-xs text-red-600">{e}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Drop zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                                    ${dragging ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-orange-300 hover:bg-orange-50/40'}`}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <div className="text-3xl mb-2">📂</div>
                                {fileName ? (
                                    <p className="text-sm font-semibold text-gray-800">{fileName}</p>
                                ) : (
                                    <>
                                        <p className="text-sm font-semibold text-gray-700">Drop your Excel or CSV file here</p>
                                        <p className="text-xs text-gray-400 mt-1">or click to browse — .xlsx, .xls, .csv supported</p>
                                    </>
                                )}
                            </div>

                            {/* Template download */}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Need a template?</span>
                                <button
                                    onClick={downloadTemplate}
                                    className="text-orange-500 hover:underline font-semibold"
                                >
                                    Download suppliers_template.xlsx
                                </button>
                            </div>

                            {/* Parse errors */}
                            {parseErrors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                                        Parse warnings
                                    </p>
                                    {parseErrors.map((e, i) => (
                                        <p key={i} className="text-xs text-red-600">{e}</p>
                                    ))}
                                </div>
                            )}

                            {/* Preview table */}
                            {preview.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                        Preview — {preview.length} supplier{preview.length !== 1 ? 's' : ''} found
                                    </p>
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Org No.</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Categories</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {preview.map((s, i) => (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
                                                        <td className="px-3 py-2 text-gray-500">{s.email ?? '—'}</td>
                                                        <td className="px-3 py-2 text-gray-500">{s.phone ?? '—'}</td>
                                                        <td className="px-3 py-2 font-mono text-gray-500">{s.orgNumber ?? '—'}</td>
                                                        <td className="px-3 py-2 text-gray-500">{s.contactPerson ?? '—'}</td>
                                                        <td className="px-3 py-2 text-gray-500">{s.categories?.join(', ') ?? '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        Existing suppliers with the same name will be updated, not duplicated.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                        >
                            {summary ? 'Close' : 'Cancel'}
                        </button>
                        {!summary && (
                            <button
                                onClick={handleImport}
                                disabled={preview.length === 0 || importing}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                {importing ? 'Importing…' : `Import ${preview.length > 0 ? preview.length : ''} Supplier${preview.length !== 1 ? 's' : ''}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
