'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useInventory } from '@/context/InventoryContext'
import { getDealershipId, getDealershipTag } from '@/lib/tenant'
import type { Motorcycle, SparePart, Accessory, InventoryCategory } from '@/utils/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedSheet = {
    motorcycles: Partial<Motorcycle>[]
    spareParts:  Partial<SparePart>[]
    accessories: Partial<Accessory>[]
}

type ImportSummary = {
    motorcycles: number
    spareParts:  number
    accessories: number
    updated:     number
    skipped:     number
    errors:      string[]
}

type AnyItem = Motorcycle | SparePart | Accessory
type AnyPartial = Partial<Motorcycle> | Partial<SparePart> | Partial<Accessory>

type ConflictResolution = 'addStock' | 'skip' | 'separate'

type ConflictReason = 'exact' | 'nameAndBrand' | 'nameOnly' | 'articleOnly'

type ConflictEntry = {
    key:        string   // unique key for this conflict
    type:       InventoryCategory
    rowIndex:   number
    existing:   AnyItem
    incoming:   AnyPartial
    resolution: ConflictResolution
    reason:     ConflictReason
}

// ─── Column maps (header → field) ─────────────────────────────────────────────

const MC_COLS: Record<string, keyof Motorcycle> = {
    'name':            'name',
    'brand':           'brand',
    'article number':  'articleNumber',
    'article no':      'articleNumber',
    'vin':             'vin',
    'year':            'year',
    'engine cc':       'engineCC',
    'cc':              'engineCC',
    'color':           'color',
    'colour':          'color',
    'mc type':         'mcType',
    'type':            'mcType',
    'warehouse':       'warehouse',
    'stock':           'stock',
    'reorder qty':     'reorderQty',
    'reorder':         'reorderQty',
    'cost':            'cost',
    'selling price':   'sellingPrice',
    'sell price':      'sellingPrice',
    'price':           'sellingPrice',
    'vendor':          'vendor',
    'supplier':        'vendor',
    'description':     'description',
}

const SP_COLS: Record<string, keyof SparePart> = {
    'name':            'name',
    'brand':           'brand',
    'article number':  'articleNumber',
    'article no':      'articleNumber',
    'category':        'category',
    'stock':           'stock',
    'reorder qty':     'reorderQty',
    'reorder':         'reorderQty',
    'cost':            'cost',
    'selling price':   'sellingPrice',
    'sell price':      'sellingPrice',
    'price':           'sellingPrice',
    'vendor':          'vendor',
    'supplier':        'vendor',
    'description':     'description',
}

const ACC_COLS: Record<string, keyof Accessory> = {
    'name':            'name',
    'brand':           'brand',
    'article number':  'articleNumber',
    'article no':      'articleNumber',
    'category':        'category',
    'size':            'size',
    'stock':           'stock',
    'reorder qty':     'reorderQty',
    'reorder':         'reorderQty',
    'cost':            'cost',
    'selling price':   'sellingPrice',
    'sell price':      'sellingPrice',
    'price':           'sellingPrice',
    'vendor':          'vendor',
    'supplier':        'vendor',
    'description':     'description',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates an ID with UUID fingerprint: e.g. SP-AVA-4D85-001
 * Matches the format used by AddItemModal's generateNextId.
 */
function generateNextImportId(
    prefix: string,
    batchIndex: number,
    existingIds: string[],
): string {
    const tag          = getDealershipTag()
    const dealershipId = getDealershipId()
    const fp           = (dealershipId ?? '').replace(/-/g, '').substring(0, 4).toUpperCase() || 'XXXX'
    const taggedPrefix = `${prefix}-${tag}-${fp}-`
    const nums         = existingIds
        .filter((id) => id.startsWith(taggedPrefix))
        .map((id) => parseInt(id.replace(taggedPrefix, ''), 10))
        .filter((n) => !isNaN(n))
    const maxExisting = nums.length > 0 ? Math.max(...nums) : 0
    const next        = maxExisting + batchIndex + 1
    return `${taggedPrefix}${String(next).padStart(3, '0')}`
}

function parseRows<T>(
    sheet: XLSX.WorkSheet,
    colMap: Record<string, keyof T>,
): Partial<T>[] {
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw:    false,
    })
    return json.map((row) => {
        const out: Partial<T> = {}
        for (const [header, value] of Object.entries(row)) {
            const key = colMap[header.toLowerCase().trim()]
            if (key) (out as Record<string, unknown>)[key as string] = value
        }
        return out
    })
}

function num(v: unknown) { return Number(v) || 0 }
function str(v: unknown) { return String(v ?? '').trim() }

// ─── Download template ────────────────────────────────────────────────────────

function downloadTemplate() {
    const wb = XLSX.utils.book_new()

    const mcHeaders  = [['Name','Brand','Article Number','VIN','Year','Engine CC','Color','MC Type','Warehouse','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]
    const spHeaders  = [['Name','Brand','Article Number','Category','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]
    const accHeaders = [['Name','Brand','Article Number','Category','Size','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]

    const mcSample  = [['Yamaha MT-07','Yamaha','ART-001','1HGBH41JXMN109186',2024,689,'Midnight Black','New','Warehouse A',3,2,79900,94900,'Yamaha Sverige AB','Mid-weight naked bike']]
    const spSample  = [['Brake Pad Set','Brembo','SP-BP-001','Brakes',15,5,450,750,'BikeParts AB','Front brake pads for most naked bikes']]
    const accSample = [['Shoei NXR2 Helmet','Shoei','ACC-H-001','Helmet','M',8,3,3800,5200,'Helmet World AB','Full-face racing helmet']]

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...mcHeaders,  ...mcSample]),  'Motorcycles')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...spHeaders,  ...spSample]),  'Spare Parts')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...accHeaders, ...accSample]), 'Accessories')

    XLSX.writeFile(wb, 'AVA_Inventory_Import_Template.xlsx')
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ImportInventoryModal({ onClose }: { onClose: () => void }) {
    const { motorcycles, spareParts, accessories, addItem, updateItem } = useInventory()

    const [parsed,    setParsed]    = useState<ParsedSheet | null>(null)
    const [fileName,  setFileName]  = useState('')
    const [importing, setImporting] = useState(false)
    const [done,      setDone]      = useState<ImportSummary | null>(null)
    const [dragOver,  setDragOver]  = useState(false)

    // Conflict resolution step
    const [conflicts,    setConflicts]    = useState<ConflictEntry[] | null>(null)
    const [resolutions,  setResolutions]  = useState<Record<string, ConflictResolution>>({})

    const inputRef = useRef<HTMLInputElement>(null)

    const processFile = useCallback((file: File) => {
        setFileName(file.name)
        setParsed(null)
        setConflicts(null)
        setResolutions({})
        const reader = new FileReader()
        reader.onload = (e) => {
            const data = e.target?.result
            const wb   = XLSX.read(data, { type: 'binary' })

            const findSheet = (...names: string[]) => {
                for (const name of names) {
                    const match = wb.SheetNames.find(
                        (s) => s.toLowerCase().replace(/[^a-z]/g, '') === name.toLowerCase().replace(/[^a-z]/g, '')
                    )
                    if (match) return wb.Sheets[match]
                }
                return null
            }

            const mcSheet  = findSheet('motorcycles', 'motorcycle', 'mc', 'bikes')
            const spSheet  = findSheet('spareparts', 'spare_parts', 'sparepart', 'parts')
            const accSheet = findSheet('accessories', 'accessory', 'acc', 'gear')

            setParsed({
                motorcycles: mcSheet  ? parseRows<Motorcycle>(mcSheet,  MC_COLS)  : [],
                spareParts:  spSheet  ? parseRows<SparePart> (spSheet,  SP_COLS)  : [],
                accessories: accSheet ? parseRows<Accessory> (accSheet, ACC_COLS) : [],
            })
        }
        reader.readAsBinaryString(file)
    }, [])

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) processFile(file)
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) processFile(file)
    }

    /** Step 1: Check for duplicates before importing */
    function checkConflicts() {
        if (!parsed) return

        const found: ConflictEntry[] = []

        const check = (
            type: InventoryCategory,
            rows: AnyPartial[],
            pool: AnyItem[],
        ) => {
            rows.forEach((row, i) => {
                if (!row.name) return
                const articleLower = str(row.articleNumber).toLowerCase()
                const nameLower    = str(row.name).toLowerCase()
                if (!articleLower && !nameLower) return

                const existing = pool.find(
                    (item) =>
                        (articleLower !== '' && (item.articleNumber ?? '').trim().toLowerCase() === articleLower) ||
                        item.name.trim().toLowerCase() === nameLower,
                )
                if (existing) {
                    const key         = `${type}-${i}`
                    const incomingBrand = str((row as Record<string, unknown>).brand).toLowerCase()
                    const nameSame    = existing.name.trim().toLowerCase() === nameLower
                    const brandSame   = (existing.brand ?? '').trim().toLowerCase() === incomingBrand
                    const articleSame = articleLower !== '' && (existing.articleNumber ?? '').trim().toLowerCase() === articleLower
                    const reason: ConflictReason =
                        nameSame && articleSame ? 'exact' :
                        nameSame && brandSame   ? 'nameAndBrand' :
                        nameSame                ? 'nameOnly' :
                                                 'articleOnly'
                    found.push({ key, type, rowIndex: i, existing, incoming: row, resolution: 'addStock', reason })
                }
            })
        }

        check('motorcycles', parsed.motorcycles, motorcycles)
        check('spareParts',  parsed.spareParts,  spareParts)
        check('accessories', parsed.accessories, accessories)

        if (found.length > 0) {
            setConflicts(found)
            const defaultRes: Record<string, ConflictResolution> = {}
            found.forEach((c) => { defaultRes[c.key] = 'addStock' })
            setResolutions(defaultRes)
        } else {
            setConflicts([])
            runImport([])
        }
    }

    function setResolution(key: string, res: ConflictResolution) {
        setResolutions((prev) => ({ ...prev, [key]: res }))
    }

    /** Step 2: Run the actual import with conflict resolutions applied */
    async function runImport(resolvedConflicts: ConflictEntry[]) {
        if (!parsed) return
        setImporting(true)
        const errors: string[] = []
        let mcCount = 0, spCount = 0, accCount = 0, updatedCount = 0, skippedCount = 0

        // Build lookup of conflicted row keys → resolution
        const conflictMap = new Map<string, ConflictResolution>()
        resolvedConflicts.forEach((c) => {
            conflictMap.set(`${c.type}-${c.rowIndex}`, resolutions[c.key] ?? 'addStock')
        })

        // Pre-generate all IDs upfront to avoid collisions within the batch
        const mcValidRows  = parsed.motorcycles.filter((r) => r.name)
        const spValidRows  = parsed.spareParts.filter((r) => r.name)
        const accValidRows = parsed.accessories.filter((r) => r.name)

        const mcIds  = mcValidRows.map((_, i)  => generateNextImportId('MC',  i, motorcycles.map((m) => m.id)))
        const spIds  = spValidRows.map((_, i)  => generateNextImportId('SP',  i, spareParts.map((s) => s.id)))
        const accIds = accValidRows.map((_, i) => generateNextImportId('ACC', i, accessories.map((a) => a.id)))

        // Import Motorcycles
        let mcBatchIdx = 0
        for (let i = 0; i < parsed.motorcycles.length; i++) {
            const row = parsed.motorcycles[i]
            if (!row.name) continue
            const conflictKey = `motorcycles-${i}`
            const resolution  = conflictMap.get(conflictKey)
            try {
                if (resolution === 'addStock') {
                    // Update existing item's stock
                    const conflict = resolvedConflicts.find((c) => c.key === `motorcycles-${i}`)
                    if (conflict) {
                        const updated = { ...conflict.existing, stock: conflict.existing.stock + num(row.stock) }
                        await updateItem('motorcycles', updated)
                        updatedCount++
                        mcBatchIdx++
                        continue
                    }
                } else if (resolution === 'skip') {
                    skippedCount++
                    mcBatchIdx++
                    continue
                }
                // 'separate' or no conflict — insert new
                await addItem('motorcycles', {
                    id:            mcIds[mcBatchIdx],
                    name:          str(row.name),
                    brand:         str(row.brand),
                    articleNumber: str(row.articleNumber),
                    vin:           str(row.vin),
                    year:          num(row.year) || new Date().getFullYear(),
                    engineCC:      num(row.engineCC),
                    color:         str(row.color),
                    mcType:        (['New','Trade-In','Commission'].includes(str(row.mcType)) ? row.mcType : 'New') as 'New' | 'Trade-In' | 'Commission',
                    warehouse:     (['Warehouse A','Warehouse B','Warehouse C','Warehouse D'].includes(str(row.warehouse)) ? row.warehouse : 'Warehouse A') as 'Warehouse A' | 'Warehouse B' | 'Warehouse C' | 'Warehouse D',
                    stock:         num(row.stock),
                    reorderQty:    num(row.reorderQty),
                    cost:          num(row.cost),
                    sellingPrice:  num(row.sellingPrice),
                    vendor:        str(row.vendor),
                    description:   str(row.description),
                })
                mcCount++
            } catch (e: unknown) {
                errors.push(`Motorcycle row ${i + 2}: ${e instanceof Error ? e.message : 'failed'}`)
            }
            mcBatchIdx++
        }

        // Import Spare Parts
        let spBatchIdx = 0
        for (let i = 0; i < parsed.spareParts.length; i++) {
            const row = parsed.spareParts[i]
            if (!row.name) continue
            const conflictKey = `spareParts-${i}`
            const resolution  = conflictMap.get(conflictKey)
            try {
                if (resolution === 'addStock') {
                    const conflict = resolvedConflicts.find((c) => c.key === `spareParts-${i}`)
                    if (conflict) {
                        const updated = { ...conflict.existing, stock: conflict.existing.stock + num(row.stock) }
                        await updateItem('spareParts', updated)
                        updatedCount++
                        spBatchIdx++
                        continue
                    }
                } else if (resolution === 'skip') {
                    skippedCount++
                    spBatchIdx++
                    continue
                }
                await addItem('spareParts', {
                    id:            spIds[spBatchIdx],
                    name:          str(row.name),
                    brand:         str(row.brand),
                    articleNumber: str(row.articleNumber),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    category:      (str(row.category) || 'Engine') as any,
                    stock:         num(row.stock),
                    reorderQty:    num(row.reorderQty),
                    cost:          num(row.cost),
                    sellingPrice:  num(row.sellingPrice),
                    vendor:        str(row.vendor),
                    description:   str(row.description),
                })
                spCount++
            } catch (e: unknown) {
                errors.push(`Spare part row ${i + 2}: ${e instanceof Error ? e.message : 'failed'}`)
            }
            spBatchIdx++
        }

        // Import Accessories
        let accBatchIdx = 0
        for (let i = 0; i < parsed.accessories.length; i++) {
            const row = parsed.accessories[i]
            if (!row.name) continue
            const conflictKey = `accessories-${i}`
            const resolution  = conflictMap.get(conflictKey)
            try {
                if (resolution === 'addStock') {
                    const conflict = resolvedConflicts.find((c) => c.key === `accessories-${i}`)
                    if (conflict) {
                        const updated = { ...conflict.existing, stock: conflict.existing.stock + num(row.stock) }
                        await updateItem('accessories', updated)
                        updatedCount++
                        accBatchIdx++
                        continue
                    }
                } else if (resolution === 'skip') {
                    skippedCount++
                    accBatchIdx++
                    continue
                }
                await addItem('accessories', {
                    id:            accIds[accBatchIdx],
                    name:          str(row.name),
                    brand:         str(row.brand),
                    articleNumber: str(row.articleNumber),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    category:      (str(row.category) || 'Helmet') as any,
                    size:          str(row.size) || undefined,
                    stock:         num(row.stock),
                    reorderQty:    num(row.reorderQty),
                    cost:          num(row.cost),
                    sellingPrice:  num(row.sellingPrice),
                    vendor:        str(row.vendor),
                    description:   str(row.description),
                })
                accCount++
            } catch (e: unknown) {
                errors.push(`Accessory row ${i + 2}: ${e instanceof Error ? e.message : 'failed'}`)
            }
            accBatchIdx++
        }

        setImporting(false)
        setDone({ motorcycles: mcCount, spareParts: spCount, accessories: accCount, updated: updatedCount, skipped: skippedCount, errors })
    }

    const totalRows = parsed
        ? parsed.motorcycles.filter((r) => r.name).length +
          parsed.spareParts.filter((r) => r.name).length +
          parsed.accessories.filter((r) => r.name).length
        : 0

    // ── Success screen ───────────────────────────────────────────────────────
    if (done) {
        const total = done.motorcycles + done.spareParts + done.accessories
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="text-5xl mb-4">{done.errors.length === 0 ? '🎉' : '⚠️'}</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Import Complete</h2>
                    <p className="text-gray-500 text-sm mb-6">{total} item{total !== 1 ? 's' : ''} imported successfully</p>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { icon: '🏍️', label: 'Motorcycles', count: done.motorcycles },
                            { icon: '🔧', label: 'Spare Parts', count: done.spareParts },
                            { icon: '🪖', label: 'Accessories', count: done.accessories },
                        ].map((s) => (
                            <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                                <div className="text-2xl mb-1">{s.icon}</div>
                                <div className="text-lg font-bold text-gray-800">{s.count}</div>
                                <div className="text-xs text-gray-500">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {(done.updated > 0 || done.skipped > 0) && (
                        <div className="flex gap-3 mb-4">
                            {done.updated > 0 && (
                                <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                                    <div className="text-lg font-bold text-blue-700">{done.updated}</div>
                                    <div className="text-xs text-blue-500">Stock updated</div>
                                </div>
                            )}
                            {done.skipped > 0 && (
                                <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                                    <div className="text-lg font-bold text-gray-600">{done.skipped}</div>
                                    <div className="text-xs text-gray-400">Skipped</div>
                                </div>
                            )}
                        </div>
                    )}

                    {done.errors.length > 0 && (
                        <div className="mb-4 text-left bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                            {done.errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-600">{e}</p>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
                    >
                        View Inventory
                    </button>
                </div>
            </div>
        )
    }

    // ── Conflict resolution screen ───────────────────────────────────────────
    if (conflicts && conflicts.length > 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-amber-100 shrink-0 bg-amber-50">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold mb-0.5">
                                Duplicate Items Found
                            </p>
                            <h2 className="text-xl font-bold text-gray-900">
                                {conflicts.length} item{conflicts.length !== 1 ? 's' : ''} already exist in inventory
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">Choose what to do for each duplicate before importing.</p>
                        </div>
                    </div>

                    {/* Conflict list */}
                    <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
                        {conflicts.map((c) => {
                            const res = resolutions[c.key] ?? 'addStock'
                            const incomingStock = num((c.incoming as Record<string, unknown>).stock)
                            return (
                                <div key={c.key} className="border border-gray-200 rounded-xl overflow-hidden">
                                    {/* Item info */}
                                    <div className="bg-gray-50 px-4 py-3 flex items-start justify-between gap-4">
                                        <div>
                                            {c.reason === 'nameAndBrand' && (
                                                <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold mb-1">
                                                    Same name &amp; brand — different article number
                                                </p>
                                            )}
                                            {c.reason === 'nameOnly' && (
                                                <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold mb-1">
                                                    Same name — different brand &amp; article
                                                </p>
                                            )}
                                            {c.reason === 'articleOnly' && (
                                                <p className="text-[10px] uppercase tracking-widest text-red-500 font-semibold mb-1">
                                                    Article number taken by a different product
                                                </p>
                                            )}
                                            {c.reason === 'exact' && (
                                                <p className="text-[10px] uppercase tracking-widest text-red-500 font-semibold mb-1">
                                                    Exact duplicate
                                                </p>
                                            )}
                                            <p className="text-sm font-bold text-gray-800">{c.existing.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Article: <span className="font-mono">{c.existing.articleNumber || '—'}</span>
                                                {' · '}Current stock: <span className="font-semibold text-gray-700">{c.existing.stock}</span>
                                                {incomingStock > 0 && (
                                                    <> → importing <span className="font-semibold text-orange-600">+{incomingStock}</span></>
                                                )}
                                            </p>
                                        </div>
                                        <span className="text-xs shrink-0 bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                                            {c.type === 'spareParts' ? 'Spare Part' : c.type === 'motorcycles' ? 'Motorcycle' : 'Accessory'}
                                        </span>
                                    </div>

                                    {/* Resolution buttons */}
                                    {(() => {
                                        const articleConflict = c.reason === 'exact' || c.reason === 'articleOnly'
                                        return (
                                            <div className="px-4 py-3 flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => setResolution(c.key, 'addStock')}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                        res === 'addStock'
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                                                    }`}
                                                >
                                                    + Add {incomingStock} to stock ({c.existing.stock} → {c.existing.stock + incomingStock})
                                                </button>
                                                {articleConflict ? (
                                                    <span className="px-3 py-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg">
                                                        Article no. taken — cannot save as separate
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => setResolution(c.key, 'separate')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                            res === 'separate'
                                                                ? 'bg-orange-500 text-white border-orange-500'
                                                                : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                                                        }`}
                                                    >
                                                        Save as separate item
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setResolution(c.key, 'skip')}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                        res === 'skip'
                                                            ? 'bg-gray-500 text-white border-gray-500'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                                    }`}
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                        )
                                    })()}
                                </div>
                            )
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                        <button
                            onClick={() => { setConflicts(null); setResolutions({}) }}
                            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={() => runImport(conflicts)}
                            disabled={importing}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            {importing ? 'Importing…' : 'Proceed with Import'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Main screen ──────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Bulk Import</p>
                        <h2 className="text-xl font-bold text-gray-900">Import Inventory</h2>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 text-sm font-bold">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

                    {/* Template download */}
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-blue-800">Download the Excel template</p>
                            <p className="text-xs text-blue-600 mt-0.5">3 sheets: Motorcycles, Spare Parts, Accessories</p>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            ⬇ Template
                        </button>
                    </div>

                    {/* Drop zone */}
                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                            dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                        }`}
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={onFileChange}
                        />
                        {fileName ? (
                            <>
                                <div className="text-3xl mb-2">📊</div>
                                <p className="font-semibold text-gray-800 text-sm">{fileName}</p>
                                <p className="text-xs text-gray-400 mt-1">Click to change file</p>
                            </>
                        ) : (
                            <>
                                <div className="text-4xl mb-3">📂</div>
                                <p className="font-semibold text-gray-700">Drop your Excel or CSV file here</p>
                                <p className="text-xs text-gray-400 mt-1">or click to browse — .xlsx, .xls, .csv</p>
                            </>
                        )}
                    </div>

                    {/* Preview */}
                    {parsed && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Preview</p>
                            {[
                                { icon: '🏍️', label: 'Motorcycles', rows: parsed.motorcycles.filter((r) => r.name) },
                                { icon: '🔧', label: 'Spare Parts', rows: parsed.spareParts.filter((r) => r.name) },
                                { icon: '🪖', label: 'Accessories', rows: parsed.accessories.filter((r) => r.name) },
                            ].map(({ icon, label, rows }) => (
                                <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{icon}</span>
                                        <span className="text-sm font-medium text-gray-700">{label}</span>
                                    </div>
                                    <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${
                                        rows.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'
                                    }`}>
                                        {rows.length} row{rows.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            ))}

                            {totalRows === 0 && (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                                    No data found. Make sure your sheet names match: <strong>Motorcycles</strong>, <strong>Spare Parts</strong>, <strong>Accessories</strong>
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        {totalRows > 0 ? `${totalRows} items ready to import` : 'Upload a file to preview'}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={checkConflicts}
                            disabled={!parsed || totalRows === 0 || importing}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            {importing ? 'Importing…' : `Import ${totalRows > 0 ? totalRows + ' Items' : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
