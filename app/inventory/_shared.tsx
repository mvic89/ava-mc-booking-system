'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useInventory } from '@/context/InventoryContext'
import { Motorcycle, SparePart, Accessory, BaseInventoryItem, InventoryCategory, accessoryGroup } from '@/utils/types'
import { AddItemModal } from '@/components/AddItemModal'
import { ImportInventoryModal } from '@/components/ImportInventoryModal'
import { EditItemModal } from '@/components/EditItemModal'

// ─── Column resize + drag-to-reorder ─────────────────────────────────────────

function useColumnState(defaultWidths: number[]) {
    const [widths,      setWidths     ] = useState<number[]>(defaultWidths)
    const [order,       setOrder      ] = useState<number[]>(() => defaultWidths.map((_, i) => i))
    const [draggingPos, setDraggingPos] = useState<number | null>(null)
    const [dragOverPos, setDragOverPos] = useState<number | null>(null)
    const dragFrom  = useRef<number | null>(null)   // reliable source of truth during drag
    const resizing  = useRef<{ pos: number; startX: number; startW: number } | null>(null)

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResizeMouseDown = useCallback((pos: number, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        resizing.current = { pos, startX: e.clientX, startW: widths[pos] }
        const onMove = (mv: MouseEvent) => {
            if (!resizing.current) return
            const delta = mv.clientX - resizing.current.startX
            const newW  = Math.max(50, resizing.current.startW + delta)
            setWidths(prev => prev.map((w, i) => i === resizing.current!.pos ? newW : w))
        }
        const onUp = () => {
            resizing.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [widths])

    // ── Drag reorder ──────────────────────────────────────────────────────────
    const onDragStart = useCallback((pos: number, e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move'
        dragFrom.current = pos
        setDraggingPos(pos)
    }, [])

    const onDragOver = useCallback((pos: number, e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverPos(pos)
    }, [])

    const onDrop = useCallback((targetPos: number, e: React.DragEvent) => {
        e.preventDefault()
        const from = dragFrom.current
        dragFrom.current = null
        setDraggingPos(null)
        setDragOverPos(null)
        if (from === null || from === targetPos) return
        setOrder(o => {
            const next = [...o]
            const [moved] = next.splice(from, 1)
            next.splice(targetPos, 0, moved)
            return next
        })
        setWidths(w => {
            const next = [...w]
            const [moved] = next.splice(from, 1)
            next.splice(targetPos, 0, moved)
            return next
        })
    }, [])

    const onDragEnd = useCallback(() => {
        dragFrom.current = null
        setDraggingPos(null)
        setDragOverPos(null)
    }, [])

    return { widths, order, draggingPos, dragOverPos, onResizeMouseDown, onDragStart, onDragOver, onDrop, onDragEnd }
}

// ─── Resizable + draggable column header ─────────────────────────────────────

function ColTh({ pos, width, isDragging, isDragOver, isLast, onResizeMouseDown, onDragStart, onDragOver, onDrop, onDragEnd, children }: {
    pos: number
    width: number
    isDragging: boolean
    isDragOver: boolean
    isLast: boolean
    onResizeMouseDown: (pos: number, e: React.MouseEvent) => void
    onDragStart: (pos: number, e: React.DragEvent) => void
    onDragOver: (pos: number, e: React.DragEvent) => void
    onDrop: (pos: number, e: React.DragEvent) => void
    onDragEnd: () => void
    children?: React.ReactNode
}) {
    return (
        <th
            draggable
            onDragStart={e => onDragStart(pos, e)}
            onDragOver={e => onDragOver(pos, e)}
            onDrop={e => onDrop(pos, e)}
            onDragEnd={onDragEnd}
            style={{ width, minWidth: width, maxWidth: width }}
            className={[
                'relative px-3 py-3 text-left text-xs uppercase tracking-wider font-semibold select-none',
                'border-r border-slate-200 transition-colors',
                isLast ? 'border-r-0' : '',
                isDragging  ? 'opacity-40 bg-slate-50' : 'text-slate-400',
                isDragOver  ? 'bg-[#FF6B2C]/10 border-l-2 border-l-[#FF6B2C]' : '',
            ].join(' ')}
        >
            <span className="flex items-center gap-1.5 cursor-grab whitespace-nowrap overflow-hidden">
                <svg className="w-3 h-3 text-slate-300 shrink-0" viewBox="0 0 8 14" fill="currentColor">
                    <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                    <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                    <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                </svg>
                <span className="truncate">{children}</span>
            </span>
            {/* Resize handle */}
            <span
                onMouseDown={e => onResizeMouseDown(pos, e)}
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#FF6B2C]/60 transition-colors z-10"
            />
        </th>
    )
}

// ─── Column definition type ───────────────────────────────────────────────────

type ColHelpers = { updateStock: (id: string, s: number) => void; onDelete: (id: string) => void }
type ColDef<T> = {
    label: string
    defaultWidth: number
    tdClass?: string
    noClick?: boolean   // stops row click propagation on this td
    cell: (item: T, h: ColHelpers) => React.ReactNode
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'SEK' }).format(value)
}

function formatSEK(value: number) {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(value)
}

function StockBadge({ stock, reorderQty }: { stock: number; reorderQty: number }) {
    const isLow = stock <= reorderQty
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`} />
            {stock} units
        </span>
    )
}

function StockCell({ item, updateStock }: { item: BaseInventoryItem; updateStock: (id: string, stock: number) => void }) {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={(e) => { e.stopPropagation(); updateStock(item.id, item.stock - 1) }}
                title="Decrease stock"
                className="w-5 h-5 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0"
            >−</button>
            <StockBadge stock={item.stock} reorderQty={item.reorderQty} />
            <button
                onClick={(e) => { e.stopPropagation(); updateStock(item.id, item.stock + 1) }}
                title="Increase stock"
                className="w-5 h-5 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center shrink-0"
            >+</button>
        </div>
    )
}

// ─── Generic reorderable table ────────────────────────────────────────────────

function ReorderableTable<T>({ cols, data, defaultWidths, onRowClick }: {
    cols: ColDef<T>[]
    data: T[]
    defaultWidths: number[]
    onRowClick: (item: T) => void
}) {
    const { widths, order, draggingPos, dragOverPos, onResizeMouseDown, onDragStart, onDragOver, onDrop, onDragEnd } = useColumnState(defaultWidths)
    const helpers: ColHelpers = { updateStock: () => {}, onDelete: () => {} } // closed over in each col def
    const totalW = widths.reduce((a, b) => a + b, 0)
    return (
        <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: totalW }}>
            <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
            <thead>
                <tr className="border-b border-slate-200">
                    {order.map((origIdx, pos) => (
                        <ColTh
                            key={origIdx}
                            pos={pos}
                            width={widths[pos]}
                            isDragging={draggingPos === pos}
                            isDragOver={dragOverPos === pos}
                            isLast={pos === order.length - 1}
                            onResizeMouseDown={onResizeMouseDown}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            onDragEnd={onDragEnd}
                        >
                            {cols[origIdx].label}
                        </ColTh>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {data.map((item, rowIdx) => (
                    <tr
                        key={rowIdx}
                        onClick={() => onRowClick(item)}
                        className="group hover:bg-[#FF6B2C]/5 transition-colors cursor-pointer"
                    >
                        {order.map((origIdx, pos) => {
                            const col = cols[origIdx]
                            return (
                                <td
                                    key={origIdx}
                                    className={[
                                        'px-3 py-3 border-r border-slate-100 overflow-hidden',
                                        pos === order.length - 1 ? 'border-r-0' : '',
                                        col.tdClass ?? '',
                                    ].join(' ')}
                                    onClick={col.noClick ? e => e.stopPropagation() : undefined}
                                >
                                    {col.cell(item, helpers)}
                                </td>
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

// ─── Tables ───────────────────────────────────────────────────────────────────

function MotorcycleTable({ data, updateStock, onRowClick, onDelete }: {
    data: Motorcycle[]
    updateStock: (id: string, stock: number) => void
    onRowClick: (item: Motorcycle) => void
    onDelete: (id: string) => void
}) {
    const cols: ColDef<Motorcycle>[] = [
        { label: 'ID',           defaultWidth: 120, tdClass: 'font-mono text-xs text-slate-400 truncate',  cell: m => m.id },
        { label: 'Name / Brand', defaultWidth: 180, cell: m => (
            <>
                <div className="font-semibold text-slate-800 truncate">{m.name}</div>
                <div className="text-xs text-[#FF6B2C] font-medium truncate">{m.brand}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate" title={m.description}>{m.description}</div>
            </>
        )},
        { label: 'Article No.',  defaultWidth: 110, tdClass: 'font-mono text-xs text-slate-500 truncate',  cell: m => m.articleNumber },
        { label: 'VIN',          defaultWidth: 130, tdClass: 'font-mono text-xs text-blue-600 truncate',   cell: m => m.vin },
        { label: 'Year',         defaultWidth: 60,  tdClass: 'text-slate-700 text-xs',                     cell: m => m.year },
        { label: 'Engine',       defaultWidth: 75,  tdClass: 'text-slate-700 text-xs truncate',             cell: m => `${m.engineCC}cc` },
        { label: 'Color',        defaultWidth: 90,  cell: m => (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0" style={{ background: m.color.toLowerCase().includes('black') ? '#1f2937' : m.color.toLowerCase().includes('white') ? '#f9fafb' : m.color.toLowerCase().includes('red') ? '#dc2626' : m.color.toLowerCase().includes('green') ? '#16a34a' : m.color.toLowerCase().includes('blue') ? '#2563eb' : m.color.toLowerCase().includes('yellow') || m.color.toLowerCase().includes('gold') ? '#ca8a04' : m.color.toLowerCase().includes('gray') || m.color.toLowerCase().includes('grey') ? '#6b7280' : m.color.toLowerCase().includes('orange') ? '#ea580c' : '#d1d5db' }} />
                <span className="truncate">{m.color}</span>
            </span>
        )},
        { label: 'MC Type',      defaultWidth: 85,  cell: m => (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${m.mcType === 'New' ? 'bg-green-100 text-green-700' : m.mcType === 'Trade-In' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{m.mcType}</span>
        )},
        { label: 'Warehouse',    defaultWidth: 110, tdClass: 'text-xs text-slate-500 truncate',            cell: m => m.warehouse },
        { label: 'Stock',        defaultWidth: 120, noClick: true, cell: (m, h) => <StockCell item={m} updateStock={updateStock} /> },
        { label: 'Reorder',      defaultWidth: 75,  tdClass: 'text-slate-500 text-xs',                     cell: m => m.reorderQty },
        { label: 'Cost',         defaultWidth: 110, tdClass: 'text-slate-700 text-xs truncate',             cell: m => formatSEK(m.cost) },
        { label: 'Sell Price',   defaultWidth: 110, tdClass: 'font-semibold text-slate-900 text-xs truncate', cell: m => formatSEK(m.sellingPrice) },
        { label: 'Margin',       defaultWidth: 70,  cell: m => <span className="text-green-600 font-medium text-xs">{(((m.sellingPrice - m.cost) / m.sellingPrice) * 100).toFixed(1)}%</span> },
        { label: 'Vendor',       defaultWidth: 130, tdClass: 'text-xs text-slate-400 truncate',             cell: m => <span title={m.vendor}>{m.vendor}</span> },
        { label: '',             defaultWidth: 40,  noClick: true, cell: m => (
            <button onClick={() => onDelete(m.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
        )},
    ]
    return <ReorderableTable cols={cols} data={data} defaultWidths={cols.map(c => c.defaultWidth)} onRowClick={onRowClick} />
}

function SparePartsTable({ data, updateStock, onRowClick, onDelete }: {
    data: SparePart[]
    updateStock: (id: string, stock: number) => void
    onRowClick: (item: SparePart) => void
    onDelete: (id: string) => void
}) {
    const cols: ColDef<SparePart>[] = [
        { label: 'ID',           defaultWidth: 120, tdClass: 'font-mono text-xs text-slate-400 truncate',     cell: s => s.id },
        { label: 'Name / Brand', defaultWidth: 180, cell: s => (
            <>
                <div className="font-semibold text-slate-800 truncate">{s.name}</div>
                <div className="text-xs text-[#FF6B2C] font-medium truncate">{s.brand}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate" title={s.description}>{s.description}</div>
            </>
        )},
        { label: 'Article No.',  defaultWidth: 110, tdClass: 'font-mono text-xs text-slate-500 truncate',     cell: s => s.articleNumber },
        { label: 'Category',     defaultWidth: 100, cell: s => <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{s.category}</span> },
        { label: 'Stock',        defaultWidth: 120, noClick: true, cell: (s, h) => <StockCell item={s} updateStock={updateStock} /> },
        { label: 'Reorder',      defaultWidth: 75,  tdClass: 'text-slate-500 text-xs',                        cell: s => s.reorderQty },
        { label: 'Cost',         defaultWidth: 110, tdClass: 'text-xs text-slate-700 truncate',               cell: s => formatCurrency(s.cost) },
        { label: 'Sell Price',   defaultWidth: 110, tdClass: 'font-semibold text-slate-900 text-xs truncate', cell: s => formatCurrency(s.sellingPrice) },
        { label: 'Margin',       defaultWidth: 70,  cell: s => <span className="text-green-600 font-medium text-xs">{(((s.sellingPrice - s.cost) / s.sellingPrice) * 100).toFixed(1)}%</span> },
        { label: 'Vendor',       defaultWidth: 130, tdClass: 'text-xs text-slate-400 truncate',               cell: s => <span title={s.vendor}>{s.vendor}</span> },
        { label: '',             defaultWidth: 40,  noClick: true, cell: s => (
            <button onClick={() => onDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
        )},
    ]
    return <ReorderableTable cols={cols} data={data} defaultWidths={cols.map(c => c.defaultWidth)} onRowClick={onRowClick} />
}

function AccessoriesTable({ data, updateStock, onRowClick, onDelete }: {
    data: Accessory[]
    updateStock: (id: string, stock: number) => void
    onRowClick: (item: Accessory) => void
    onDelete: (id: string) => void
}) {
    const cols: ColDef<Accessory>[] = [
        { label: 'ID',           defaultWidth: 120, tdClass: 'font-mono text-xs text-slate-400 truncate',     cell: a => a.id },
        { label: 'Name / Brand', defaultWidth: 180, cell: a => (
            <>
                <div className="font-semibold text-slate-800 truncate">{a.name}</div>
                <div className="text-xs text-[#FF6B2C] font-medium truncate">{a.brand}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate" title={a.description}>{a.description}</div>
            </>
        )},
        { label: 'Article No.',  defaultWidth: 110, tdClass: 'font-mono text-xs text-slate-500 truncate',     cell: a => a.articleNumber },
        { label: 'Group',        defaultWidth: 130, cell: a => {
            const grp = accessoryGroup(a.category)
            const grpStyle: Record<string, string> = {
                'Helmets':     'bg-indigo-100 text-indigo-700',
                'Clothing':    'bg-rose-100 text-rose-700',
                'Seat Covers': 'bg-amber-100 text-amber-700',
                'Luggage':     'bg-cyan-100 text-cyan-700',
                'Protection':  'bg-orange-100 text-orange-700',
                'Other':       'bg-slate-100 text-slate-600',
            }
            const subStyle: Record<string, string> = {
                'Men':        'bg-blue-50 text-blue-600',
                'Women':      'bg-pink-50 text-pink-600',
                'Unisex':     'bg-gray-100 text-gray-500',
                'Open Face':  'bg-green-50 text-green-700',
                'Full Face':  'bg-indigo-50 text-indigo-700',
                'Modular':    'bg-purple-50 text-purple-700',
                'Off-Road':   'bg-amber-50 text-amber-700',
                'Half Shell': 'bg-teal-50 text-teal-700',
            }
            return (
                <div className="flex flex-col gap-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${grpStyle[grp] ?? 'bg-slate-100 text-slate-600'}`}>{grp}</span>
                    {a.subGroup && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${subStyle[a.subGroup] ?? 'bg-gray-100 text-gray-500'}`}>{a.subGroup}</span>}
                </div>
            )
        }},
        { label: 'Category',     defaultWidth: 110, cell: a => <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">{a.category}</span> },
        { label: 'Size',         defaultWidth: 70,  tdClass: 'text-slate-700 text-xs font-medium',            cell: a => a.size ?? '—' },
        { label: 'Stock',        defaultWidth: 120, noClick: true, cell: (a, h) => <StockCell item={a} updateStock={updateStock} /> },
        { label: 'Reorder',      defaultWidth: 75,  tdClass: 'text-slate-500 text-xs',                        cell: a => a.reorderQty },
        { label: 'Cost',         defaultWidth: 110, tdClass: 'text-xs text-slate-700 truncate',               cell: a => formatCurrency(a.cost) },
        { label: 'Sell Price',   defaultWidth: 110, tdClass: 'font-semibold text-slate-900 text-xs truncate', cell: a => formatCurrency(a.sellingPrice) },
        { label: 'Margin',       defaultWidth: 70,  cell: a => <span className="text-green-600 font-medium text-xs">{(((a.sellingPrice - a.cost) / a.sellingPrice) * 100).toFixed(1)}%</span> },
        { label: 'Vendor',       defaultWidth: 130, tdClass: 'text-xs text-slate-400 truncate',               cell: a => <span title={a.vendor}>{a.vendor}</span> },
        { label: '',             defaultWidth: 40,  noClick: true, cell: a => (
            <button onClick={() => onDelete(a.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
        )},
    ]
    return <ReorderableTable cols={cols} data={data} defaultWidths={cols.map(c => c.defaultWidth)} onRowClick={onRowClick} />
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ data }: { data: BaseInventoryItem[] }) {
    const totalItems = data.length
    const totalStock = data.reduce((s, i) => s + i.stock, 0)
    const lowStock   = data.filter((i) => i.stock <= i.reorderQty).length
    const totalValue = data.reduce((s, i) => s + i.sellingPrice * i.stock, 0)
    const cards = [
        { label: 'Total SKUs',         value: String(totalItems),         icon: '📦', color: 'text-[#FF6B2C]' },
        { label: 'Units in Stock',     value: String(totalStock),         icon: '🗃️', color: 'text-green-600' },
        { label: 'Low Stock Alerts',   value: String(lowStock),           icon: '⚠️', color: 'text-red-600'   },
        { label: 'Stock Value (Sell)', value: formatCurrency(totalValue), icon: '💰', color: 'text-slate-900' },
    ]
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
                <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                    <span className="text-2xl">{c.icon}</span>
                    <div>
                        <p className={`text-xl font-extrabold ${c.color}`}>{c.value}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onImport, isFiltered }: { onImport: () => void; isFiltered: boolean }) {
    if (isFiltered) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <span className="text-4xl mb-2">🔍</span>
                <p className="text-sm font-medium">No items match your search</p>
            </div>
        )
    }
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <span className="text-5xl">📦</span>
            <div className="text-center">
                <p className="text-slate-700 font-semibold">No inventory yet</p>
                <p className="text-slate-400 text-sm mt-1">Import from Excel or add items one by one</p>
            </div>
            <button
                onClick={onImport}
                className="bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
                ⬆ Import from Excel
            </button>
        </div>
    )
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadExcel(data: BaseInventoryItem[], tabName: string) {
    import('xlsx').then((XLSX) => {
        const rows = data.map((item) => {
            const base: Record<string, unknown> = {
                ID: item.id, Name: item.name, Brand: item.brand,
                'Article No.': item.articleNumber, Stock: item.stock,
                'Reorder Qty': item.reorderQty, 'Cost (SEK)': item.cost,
                'Sell Price (SEK)': item.sellingPrice, Vendor: item.vendor,
            }
            const mc = item as Motorcycle
            if (mc.vin)       base['VIN']       = mc.vin
            if (mc.year)      base['Year']      = mc.year
            if (mc.engineCC)  base['Engine CC'] = mc.engineCC
            if (mc.color)     base['Color']     = mc.color
            if (mc.mcType)    base['MC Type']   = mc.mcType
            if (mc.warehouse) base['Warehouse'] = mc.warehouse
            const acc = item as Accessory
            if (acc.size)     base['Size']      = acc.size
            return base
        })
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, tabName)
        XLSX.writeFile(wb, `inventory_${tabName}_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
}

async function downloadInventoryPDF(data: BaseInventoryItem[], tabName: string) {
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const navy  = [30, 58, 95] as [number, number, number]
    doc.setFillColor(...navy)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('INVENTORY REPORT', 14, 14)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(147, 197, 253)
    doc.text(`${tabName} · ${data.length} items · ${new Date().toLocaleDateString('en-GB')}`, pageW - 14, 14, { align: 'right' })
    autoTable(doc, {
        startY: 28,
        head: [['ID', 'Name', 'Brand', 'Article No.', 'Stock', 'Reorder', 'Cost', 'Sell Price', 'Vendor']],
        body: data.map(i => [i.id, i.name, i.brand, i.articleNumber, i.stock, i.reorderQty, i.cost.toLocaleString('sv-SE'), i.sellingPrice.toLocaleString('sv-SE'), i.vendor]),
        headStyles: { fillColor: navy, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 22 }, 8: { cellWidth: 35 } },
        margin: { left: 14, right: 14 },
    })
    doc.save(`inventory_${tabName}_${new Date().toISOString().split('T')[0]}.pdf`)
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: InventoryCategory; label: string; icon: string; href: string }[] = [
    { id: 'motorcycles', label: 'Motorcycles', icon: '🏍️', href: '/inventory/motorcycles' },
    { id: 'spareParts',  label: 'Spare Parts',  icon: '🔧', href: '/inventory/spare-parts'  },
    { id: 'accessories', label: 'Accessories',  icon: '🪖', href: '/inventory/accessories'  },
]

// ─── Main shared page component ───────────────────────────────────────────────

export function InventoryPageContent({ category }: { category: InventoryCategory }) {
    const { motorcycles, spareParts, accessories, updateStock, deleteItem, autoPOs } = useInventory()

    const [search,          setSearch         ] = useState('')
    const [showAddModal,    setShowAddModal    ] = useState(false)
    const [showImportModal, setShowImportModal ] = useState(false)
    const [showDownload,    setShowDownload    ] = useState(false)
    const [selectedItem,    setSelectedItem    ] = useState<Motorcycle | SparePart | Accessory | null>(null)

    async function handleDelete(id: string) {
        if (!confirm('Delete this item permanently? This cannot be undone.')) return
        await deleteItem(id)
    }

    const q = search.toLowerCase()

    const filtered =
        category === 'motorcycles'
            ? motorcycles.filter(m => [m.name, m.brand, m.articleNumber, m.vin, m.vendor].some(f => f.toLowerCase().includes(q)))
            : category === 'spareParts'
            ? spareParts.filter(s => [s.name, s.brand, s.articleNumber, s.category, s.vendor].some(f => f.toLowerCase().includes(q)))
            : accessories.filter(a => [a.name, a.brand, a.articleNumber, a.category, a.vendor, a.size ?? ''].some(f => f.toLowerCase().includes(q)))

    const allData: BaseInventoryItem[] =
        category === 'motorcycles' ? motorcycles : category === 'spareParts' ? spareParts : accessories

    const pendingPOs  = autoPOs.filter(p => p.status === 'Draft').length
    const tabLabel    = TABS.find(t => t.id === category)?.label ?? ''

    return (
        <div className="lg:ml-64 h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
            <div className="brand-top-bar" />

            {/* Header */}
            <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Lager</p>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            🏍 Inventory
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">Hover any row to adjust stock — POs update instantly</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {pendingPOs > 0 && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full">
                                ⚠️ {pendingPOs} PO{pendingPOs > 1 ? 's' : ''} pending
                            </span>
                        )}
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
                        >
                            ⬆ Import Excel
                        </button>

                        {/* Download dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowDownload(v => !v)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
                            >
                                ⬇ Download <span className="text-slate-400 text-xs">▾</span>
                            </button>
                            {showDownload && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowDownload(false)} />
                                    <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-48 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-slate-100">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                {tabLabel} · {filtered.length} items
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { downloadExcel(filtered, category); setShowDownload(false) }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] transition-colors"
                                        >
                                            <span className="text-base">📊</span>
                                            <div className="text-left">
                                                <div className="font-semibold text-xs">Excel (.xlsx)</div>
                                                <div className="text-[10px] text-slate-400">Spreadsheet format</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => { downloadInventoryPDF(filtered, category); setShowDownload(false) }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] transition-colors"
                                        >
                                            <span className="text-base">📄</span>
                                            <div className="text-left">
                                                <div className="font-semibold text-xs">PDF</div>
                                                <div className="text-[10px] text-slate-400">Print-ready format</div>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                        >
                            + Add Item
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 px-5 md:px-8 py-6 flex flex-col gap-5">

                {/* Summary Cards */}
                <SummaryCards data={allData} />

                {/* Sub-nav tabs + Search */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                        {TABS.map((tab) => {
                            const count = tab.id === 'motorcycles' ? motorcycles.length : tab.id === 'spareParts' ? spareParts.length : accessories.length
                            const isActive = tab.id === category
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]' : 'bg-slate-200 text-slate-500'}`}>
                                        {count}
                                    </span>
                                </Link>
                            )
                        })}
                    </div>

                    <div className="ml-auto">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder={`Search ${tabLabel.toLowerCase()}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]/50 w-64 bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="table-scroll bg-white rounded-2xl border border-slate-200 overflow-auto flex-1 min-h-0">
                    {category === 'motorcycles' && (
                        (filtered as Motorcycle[]).length > 0
                            ? <MotorcycleTable data={filtered as Motorcycle[]} updateStock={updateStock} onRowClick={setSelectedItem} onDelete={handleDelete} />
                            : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== ''} />
                    )}
                    {category === 'spareParts' && (
                        (filtered as SparePart[]).length > 0
                            ? <SparePartsTable data={filtered as SparePart[]} updateStock={updateStock} onRowClick={setSelectedItem} onDelete={handleDelete} />
                            : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== ''} />
                    )}
                    {category === 'accessories' && (
                        (filtered as Accessory[]).length > 0
                            ? <AccessoriesTable data={filtered as Accessory[]} updateStock={updateStock} onRowClick={setSelectedItem} onDelete={handleDelete} />
                            : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== ''} />
                    )}
                </div>

            </div>

            {showAddModal    && <AddItemModal onClose={() => setShowAddModal(false)} />}
            {showImportModal && <ImportInventoryModal onClose={() => setShowImportModal(false)} />}
            {selectedItem   && <EditItemModal item={selectedItem} category={category} onClose={() => setSelectedItem(null)} />}
        </div>
    )
}
