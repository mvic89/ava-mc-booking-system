'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { getDealershipId, getDealershipTag } from '@/lib/tenant'
import { POStatus, PurchaseOrder } from '@/utils/types'

// ─── Column map ───────────────────────────────────────────────────────────────

const PO_COLS: Record<string, string> = {
    'po number':    'id',
    'po no':        'id',
    'po id':        'id',
    'vendor':       'vendor',
    'supplier':     'vendor',
    'supplier name':'vendor',
    'date':         'date',
    'order date':   'date',
    'eta':          'eta',
    'expected date':'eta',
    'delivery date':'eta',
    'status':       'status',
    'total cost':   'totalCost',
    'total':        'totalCost',
    'cost':         'totalCost',
    'notes':        'notes',
    'note':         'notes',
}

const VALID_STATUSES: POStatus[] = ['Draft', 'Reviewed', 'Sent', 'Received']

type ParsedPO = {
    id?:        string
    vendor:     string
    date:       string
    eta:        string
    status:     POStatus
    totalCost:  number
    notes?:     string
    _rowNum:    number
}

type ImportSummary = { added: number; errors: string[] }

function parseRows(rows: Record<string, unknown>[]): { pos: ParsedPO[]; errors: string[] } {
    const pos: ParsedPO[] = []
    const errors: string[] = []
    const today = new Date().toISOString().split('T')[0]

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2
        const raw: Record<string, string | number> = {}

        for (const [rawKey, val] of Object.entries(row)) {
            const key = rawKey.trim().toLowerCase()
            const field = PO_COLS[key]
            if (!field || val === undefined || val === null || val === '') continue
            raw[field] = String(val).trim()
        }

        if (!raw.vendor) {
            errors.push(`Row ${rowNum}: missing Vendor — skipped`)
            continue
        }

        // Normalise status
        let status: POStatus = 'Draft'
        if (raw.status) {
            const s = String(raw.status)
            const match = VALID_STATUSES.find((v) => v.toLowerCase() === s.toLowerCase())
            status = match ?? 'Draft'
        }

        pos.push({
            id:        raw.id ? String(raw.id) : undefined,
            vendor:    String(raw.vendor),
            date:      raw.date ? String(raw.date) : today,
            eta:       raw.eta  ? String(raw.eta)  : '',
            status,
            totalCost: raw.totalCost ? Number(String(raw.totalCost).replace(/[^0-9.]/g, '')) || 0 : 0,
            notes:     raw.notes ? String(raw.notes) : undefined,
            _rowNum:   rowNum,
        })
    }
    return { pos, errors }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportPOModal({
    existingPOs,
    onImported,
    onClose,
}: {
    existingPOs:  PurchaseOrder[]
    onImported:   (newPOs: PurchaseOrder[]) => void
    onClose:      () => void
}) {
    const [dragging,    setDragging]    = useState(false)
    const [fileName,    setFileName]    = useState('')
    const [preview,     setPreview]     = useState<ParsedPO[]>([])
    const [parseErrors, setParseErrors] = useState<string[]>([])
    const [importing,   setImporting]   = useState(false)
    const [summary,     setSummary]     = useState<ImportSummary | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

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
                const sheetName = wb.SheetNames.find((n) =>
                    n.toLowerCase().includes('po') || n.toLowerCase().includes('purchase order')
                ) ?? wb.SheetNames[0]
                const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' })
                const { pos, errors } = parseRows(rows)
                setPreview(pos)
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

    function downloadTemplate() {
        const headers = ['PO Number', 'Vendor', 'Date', 'ETA', 'Status', 'Total Cost', 'Notes']
        const example = ['', 'ABC Motors AB', '2026-03-01', '2026-03-15', 'Draft', '25000', 'Sample PO']
        const ws = XLSX.utils.aoa_to_sheet([headers, example])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'POs')
        XLSX.writeFile(wb, 'purchase_orders_template.xlsx')
    }

    async function handleImport() {
        if (preview.length === 0) return
        setImporting(true)

        const dealershipId = getDealershipId()
        const tag  = getDealershipTag()
        const year = new Date().getFullYear()
        const errors: string[] = [...parseErrors]
        const imported: PurchaseOrder[] = []

        // Find current max PO number
        const existingNums = existingPOs.map((po) => {
            const parts = po.id.split('-')
            return parseInt(parts[parts.length - 1], 10) || 0
        })
        let maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0

        for (const p of preview) {
            maxNum++
            const poId = p.id || `PO-${tag}-${year}-${String(maxNum).padStart(3, '0')}`

            const { error } = await supabase.from('purchase_orders').upsert({
                id:            poId,
                vendor:        p.vendor,
                date:          p.date,
                eta:           p.eta,
                status:        p.status,
                total_cost:    p.totalCost,
                notes:         p.notes ?? null,
                dealership_id: dealershipId,
            }, { onConflict: 'id' })

            if (error) {
                errors.push(`Row ${p._rowNum} (${p.vendor}): ${error.message}`)
            } else {
                imported.push({
                    id:        poId,
                    vendor:    p.vendor,
                    date:      p.date,
                    eta:       p.eta,
                    status:    p.status,
                    totalCost: p.totalCost,
                    notes:     p.notes,
                    items:     [],
                })
            }
        }

        setSummary({ added: imported.length, errors })
        if (imported.length > 0) onImported(imported)
        setImporting(false)
    }

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
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Bulk Import</p>
                        <h2 className="text-xl font-bold text-gray-900">Import Purchase Orders</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0"
                    >✕</button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
                    {summary ? (
                        <div className="text-center py-8">
                            <div className="text-5xl mb-4">{summary.errors.length === 0 ? '✅' : '⚠️'}</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {summary.added} purchase order{summary.added !== 1 ? 's' : ''} imported
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
                                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
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
                                <button onClick={downloadTemplate} className="text-orange-500 hover:underline font-semibold">
                                    Download purchase_orders_template.xlsx
                                </button>
                            </div>

                            {/* Parse errors */}
                            {parseErrors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Parse warnings</p>
                                    {parseErrors.map((e, i) => (
                                        <p key={i} className="text-xs text-red-600">{e}</p>
                                    ))}
                                </div>
                            )}

                            {/* Preview table */}
                            {preview.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                        Preview — {preview.length} PO{preview.length !== 1 ? 's' : ''} found
                                    </p>
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">ETA</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {preview.map((p, i) => (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 font-medium text-gray-800">{p.vendor}</td>
                                                        <td className="px-3 py-2 text-gray-500">{p.date}</td>
                                                        <td className="px-3 py-2 text-gray-500">{p.eta || '—'}</td>
                                                        <td className="px-3 py-2 text-gray-500">{p.status}</td>
                                                        <td className="px-3 py-2 text-gray-500">{p.totalCost > 0 ? p.totalCost.toLocaleString() : '—'}</td>
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
                        POs with the same ID will be updated, not duplicated.
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
                                {importing ? 'Importing…' : `Import ${preview.length > 0 ? preview.length : ''} PO${preview.length !== 1 ? 's' : ''}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
