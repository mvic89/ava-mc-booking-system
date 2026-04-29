'use client'

import { useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useInventory } from '@/context/InventoryContext'
import { Motorcycle, SparePart, Accessory, BaseInventoryItem, InventoryCategory } from '@/utils/types'
import { AddItemModal } from '@/components/AddItemModal'
import { ImportInventoryModal } from '@/components/ImportInventoryModal'
import { EditItemModal } from '@/components/EditItemModal'
import Sidebar from '@/components/Sidebar'

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

function ListingToggle({ item, toggleListing }: { item: BaseInventoryItem; toggleListing: (id: string, listed: boolean) => void }) {
    const listed = item.listedOnWebsite ?? false
    return (
        <button
            onClick={e => { e.stopPropagation(); toggleListing(item.id, !listed) }}
            title={listed ? 'Click to unlist from website' : 'Click to list on website'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                listed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'
            }`}
        >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${listed ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {listed ? 'Listed' : 'Unlisted'}
        </button>
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

function MotorcycleTable({ data, updateStock, toggleListing, onRowClick, onDelete }: {
    data: Motorcycle[]
    updateStock: (id: string, stock: number) => void
    toggleListing: (id: string, listed: boolean) => void
    onRowClick: (item: Motorcycle) => void
    onDelete: (id: string) => void
}) {
    const cols: ColDef<Motorcycle>[] = [
        { label: 'ID',           defaultWidth: 120, tdClass: 'font-mono text-xs text-slate-400 truncate',  cell: m => m.id },
        { label: 'Name / Brand', defaultWidth: 180, cell: m => (
            <div className="flex items-start gap-2">
                {m.images && m.images.length > 0
                    ? <img src={m.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-200" />
                    : <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-base">🏍️</div>
                }
                <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{m.name}</div>
                    <div className="text-xs text-[#FF6B2C] font-medium truncate">{m.brand}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate" title={m.description}>{m.description}</div>
                </div>
            </div>
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
        { label: 'Location',     defaultWidth: 90,  cell: m => m.location
            ? <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{m.location}</span>
            : <span className="text-slate-300 text-xs">—</span>
        },
        { label: 'Stock',        defaultWidth: 120, noClick: true, cell: (m, h) => <StockCell item={m} updateStock={updateStock} /> },
        { label: 'Reorder',      defaultWidth: 75,  tdClass: 'text-slate-500 text-xs',                     cell: m => m.reorderQty },
        { label: 'Cost',         defaultWidth: 110, tdClass: 'text-slate-700 text-xs truncate',             cell: m => formatSEK(m.cost) },
        { label: 'Sell Price',   defaultWidth: 110, tdClass: 'font-semibold text-slate-900 text-xs truncate', cell: m => formatSEK(m.sellingPrice) },
        { label: 'Margin',       defaultWidth: 70,  cell: m => <span className="text-green-600 font-medium text-xs">{(((m.sellingPrice - m.cost) / m.sellingPrice) * 100).toFixed(1)}%</span> },
        { label: 'Vendor',       defaultWidth: 130, tdClass: 'text-xs text-slate-400 truncate',             cell: m => <span title={m.vendor}>{m.vendor}</span> },
        { label: 'Website',      defaultWidth: 95,  noClick: true, cell: m => <ListingToggle item={m} toggleListing={toggleListing} /> },
        { label: '',             defaultWidth: 40,  noClick: true, cell: m => (
            <button onClick={() => onDelete(m.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
        )},
    ]
    return <ReorderableTable cols={cols} data={data} defaultWidths={cols.map(c => c.defaultWidth)} onRowClick={onRowClick} />
}

function SparePartsTable({ data, updateStock, toggleListing, onRowClick, onDelete }: {
    data: SparePart[]
    updateStock: (id: string, stock: number) => void
    toggleListing: (id: string, listed: boolean) => void
    onRowClick: (item: SparePart) => void
    onDelete: (id: string) => void
}) {
    const cols: ColDef<SparePart>[] = [
        { label: 'ID',           defaultWidth: 120, tdClass: 'font-mono text-xs text-slate-400 truncate',     cell: s => s.id },
        { label: 'Name / Brand', defaultWidth: 180, cell: s => (
            <div className="flex items-start gap-2">
                {s.images && s.images.length > 0
                    ? <img src={s.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-200" />
                    : <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-base">🔧</div>
                }
                <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{s.name}</div>
                    <div className="text-xs text-[#FF6B2C] font-medium truncate">{s.brand}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate" title={s.description}>{s.description}</div>
                </div>
            </div>
        )},
        { label: 'Article No.',  defaultWidth: 110, tdClass: 'font-mono text-xs text-slate-500 truncate',     cell: s => s.articleNumber },
        { label: 'Category',     defaultWidth: 110, cell: s => <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{s.category}</span> },
        { label: 'Sub-type',     defaultWidth: 140, cell: s => {
            const catColor: Record<string, string> = {
                'Engine':            'bg-red-50 text-red-700 border border-red-100',
                'Transmission':      'bg-orange-50 text-orange-700 border border-orange-100',
                'Fuel System':       'bg-amber-50 text-amber-800 border border-amber-100',
                'Exhaust':           'bg-stone-100 text-stone-700',
                'Suspension':        'bg-sky-50 text-sky-700 border border-sky-100',
                'Brakes':            'bg-rose-50 text-rose-700 border border-rose-100',
                'Tyres & Wheels':    'bg-slate-100 text-slate-700',
                'Controls & Cables': 'bg-teal-50 text-teal-700 border border-teal-100',
                'Electrical':        'bg-yellow-50 text-yellow-700 border border-yellow-100',
                'Lighting':          'bg-lime-50 text-lime-700 border border-lime-100',
                'Instruments':       'bg-violet-50 text-violet-700 border border-violet-100',
                'Body & Frame':      'bg-purple-50 text-purple-700 border border-purple-100',
                'Cooling System':    'bg-blue-50 text-blue-700 border border-blue-100',
                'Filters & Fluids':  'bg-green-50 text-green-700 border border-green-100',
            }
            return s.subCategory
                ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${catColor[s.category] ?? 'bg-gray-100 text-gray-500'}`}>{s.subCategory}</span>
                : <span className="text-slate-300 text-xs">—</span>
        }},
        { label: 'Location',     defaultWidth: 90,  cell: s => s.location
            ? <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{s.location}</span>
            : <span className="text-slate-300 text-xs">—</span>
        },
        { label: 'Stock',        defaultWidth: 120, noClick: true, cell: (s, h) => <StockCell item={s} updateStock={updateStock} /> },
        { label: 'Reorder',      defaultWidth: 75,  tdClass: 'text-slate-500 text-xs',                        cell: s => s.reorderQty },
        { label: 'Cost',         defaultWidth: 110, tdClass: 'text-xs text-slate-700 truncate',               cell: s => formatCurrency(s.cost) },
        { label: 'Sell Price',   defaultWidth: 110, tdClass: 'font-semibold text-slate-900 text-xs truncate', cell: s => formatCurrency(s.sellingPrice) },
        { label: 'Margin',       defaultWidth: 70,  cell: s => <span className="text-green-600 font-medium text-xs">{(((s.sellingPrice - s.cost) / s.sellingPrice) * 100).toFixed(1)}%</span> },
        { label: 'Vendor',       defaultWidth: 130, tdClass: 'text-xs text-slate-400 truncate',               cell: s => <span title={s.vendor}>{s.vendor}</span> },
        { label: 'Website',      defaultWidth: 95,  noClick: true, cell: s => <ListingToggle item={s} toggleListing={toggleListing} /> },
        { label: '',             defaultWidth: 40,  noClick: true, cell: s => (
            <button onClick={() => onDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
        )},
    ]
    return <ReorderableTable cols={cols} data={data} defaultWidths={cols.map(c => c.defaultWidth)} onRowClick={onRowClick} />
}

function AccessoriesTable({ data, updateStock, toggleListing, onRowClick, onDelete }: {
    data: Accessory[]
    updateStock: (id: string, stock: number) => void
    toggleListing: (id: string, listed: boolean) => void
    onRowClick: (item: Accessory) => void
    onDelete: (id: string) => void
}) {
    const cols: ColDef<Accessory>[] = [
        { label: 'ID',           defaultWidth: 120, tdClass: 'font-mono text-xs text-slate-400 truncate',     cell: a => a.id },
        { label: 'Name / Brand', defaultWidth: 180, cell: a => (
            <div className="flex items-start gap-2">
                {a.images && a.images.length > 0
                    ? <img src={a.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-200" />
                    : <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-base">🪖</div>
                }
                <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{a.name}</div>
                    <div className="text-xs text-[#FF6B2C] font-medium truncate">{a.brand}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate" title={a.description}>{a.description}</div>
                </div>
            </div>
        )},
        { label: 'Article No.',  defaultWidth: 110, tdClass: 'font-mono text-xs text-slate-500 truncate',     cell: a => a.articleNumber },
        { label: 'Type',         defaultWidth: 120, cell: a => <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{a.category}</span> },
        { label: 'Style',        defaultWidth: 130, cell: a => {
            const typeColor: Record<string, string> = {
                'Helmet':             'bg-indigo-50 text-indigo-700 border border-indigo-100',
                'Gloves':             'bg-orange-50 text-orange-700 border border-orange-100',
                'Jacket':             'bg-amber-50 text-amber-800 border border-amber-100',
                'Boots':              'bg-stone-100 text-stone-700',
                'Pants':              'bg-slate-100 text-slate-700',
                'T-Shirt':            'bg-blue-50 text-blue-600 border border-blue-100',
                'Cap':                'bg-purple-50 text-purple-700 border border-purple-100',
                'Neck & Face':        'bg-gray-200 text-gray-700',
                'Seat Cover':         'bg-emerald-50 text-emerald-700 border border-emerald-100',
                'Protection':         'bg-red-50 text-red-700 border border-red-100',
                'Luggage':            'bg-sky-50 text-sky-700 border border-sky-100',
                'Handlebars & Grips': 'bg-zinc-100 text-zinc-700',
            }
            return a.subGroup
                ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${typeColor[a.category] ?? 'bg-gray-100 text-gray-500'}`}>{a.subGroup}</span>
                : <span className="text-slate-300 text-xs">—</span>
        }},
        { label: 'Colour',       defaultWidth: 110, cell: a => a.color ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0" style={{ background:
                    a.color.toLowerCase().includes('black')  ? '#1f2937' :
                    a.color.toLowerCase().includes('white')  ? '#f9fafb' :
                    a.color.toLowerCase().includes('red')    ? '#dc2626' :
                    a.color.toLowerCase().includes('green')  ? '#16a34a' :
                    a.color.toLowerCase().includes('blue')   ? '#2563eb' :
                    a.color.toLowerCase().includes('yellow') || a.color.toLowerCase().includes('gold') ? '#ca8a04' :
                    a.color.toLowerCase().includes('gray')   || a.color.toLowerCase().includes('grey') ? '#6b7280' :
                    a.color.toLowerCase().includes('orange') ? '#ea580c' :
                    a.color.toLowerCase().includes('brown')  ? '#92400e' :
                    a.color.toLowerCase().includes('pink')   ? '#db2777' :
                    a.color.toLowerCase().includes('purple') ? '#7c3aed' :
                    a.color.toLowerCase().includes('silver') ? '#9ca3af' : '#d1d5db'
                }} />
                <span className="truncate">{a.color}</span>
            </span>
        ) : <span className="text-slate-300 text-xs">—</span> },
        { label: 'Size',         defaultWidth: 70,  tdClass: 'text-slate-700 text-xs font-medium',            cell: a => a.size ?? '—' },
        { label: 'Location',     defaultWidth: 90,  cell: a => a.location
            ? <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{a.location}</span>
            : <span className="text-slate-300 text-xs">—</span>
        },
        { label: 'Stock',        defaultWidth: 120, noClick: true, cell: (a, h) => <StockCell item={a} updateStock={updateStock} /> },
        { label: 'Reorder',      defaultWidth: 75,  tdClass: 'text-slate-500 text-xs',                        cell: a => a.reorderQty },
        { label: 'Cost',         defaultWidth: 110, tdClass: 'text-xs text-slate-700 truncate',               cell: a => formatCurrency(a.cost) },
        { label: 'Sell Price',   defaultWidth: 110, tdClass: 'font-semibold text-slate-900 text-xs truncate', cell: a => formatCurrency(a.sellingPrice) },
        { label: 'Margin',       defaultWidth: 70,  cell: a => <span className="text-green-600 font-medium text-xs">{(((a.sellingPrice - a.cost) / a.sellingPrice) * 100).toFixed(1)}%</span> },
        { label: 'Vendor',       defaultWidth: 130, tdClass: 'text-xs text-slate-400 truncate',               cell: a => <span title={a.vendor}>{a.vendor}</span> },
        { label: 'Website',      defaultWidth: 95,  noClick: true, cell: a => <ListingToggle item={a} toggleListing={toggleListing} /> },
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
        <div className="grid grid-cols-4 gap-3">
            {cards.map((c) => (
                <div key={c.label} className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center gap-2.5">
                    <span className="text-lg">{c.icon}</span>
                    <div>
                        <p className={`text-base font-extrabold leading-tight ${c.color}`}>{c.value}</p>
                        <p className="text-[10px] text-slate-400 leading-tight">{c.label}</p>
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

const TABS: { id: InventoryCategory | 'lowStock'; label: string; icon: string; href: string }[] = [
    { id: 'motorcycles', label: 'Motorcycles', icon: '🏍️', href: '/inventory/motorcycles' },
    { id: 'spareParts',  label: 'Spare Parts',  icon: '🔧', href: '/inventory/spare-parts'  },
    { id: 'accessories', label: 'Accessories',  icon: '🪖', href: '/inventory/accessories'  },
    { id: 'lowStock',    label: 'Low Stock',    icon: '⚠',  href: '/inventory/low-stock'   },
]

// ─── Main shared page component ───────────────────────────────────────────────

// ─── Filter types ─────────────────────────────────────────────────────────────

interface Filters {
    websiteStatus: 'all' | 'listed' | 'unlisted'
    brand:         string
    stockStatus:   'all' | 'instock' | 'lowstock' | 'outofstock'
    priceMin:      string
    priceMax:      string
    // motorcycle-specific
    mcType:        string
    warehouse:     string
    mcColour:      string
    // spare-part-specific
    spCategory:    string
    // accessory-specific
    accType:       string
    accSize:       string
    accColour:     string
}

const EMPTY_FILTERS: Filters = {
    websiteStatus: 'all', brand: '', stockStatus: 'all', priceMin: '', priceMax: '',
    mcType: '', warehouse: '', mcColour: '', spCategory: '', accType: '', accSize: '', accColour: '',
}

// ─── Small filter control ─────────────────────────────────────────────────────

function FLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{children}</p>
}

const fSel = 'w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#FF6B2C]/40 focus:border-[#FF6B2C]/50'
const fIn  = fSel

// ─── Main shared page component ───────────────────────────────────────────────

export function InventoryPageContent({ category }: { category: InventoryCategory }) {
    const { motorcycles, spareParts, accessories, updateStock, toggleListing, deleteItem, lowStockAlerts } = useInventory()
    const pathname = usePathname()

    const [search,          setSearch         ] = useState('')
    const [showAddModal,    setShowAddModal    ] = useState(false)
    const [showImportModal, setShowImportModal ] = useState(false)
    const [showDownload,    setShowDownload    ] = useState(false)
    const [showFilters,     setShowFilters     ] = useState(false)
    const [filters,         setFilters         ] = useState<Filters>(EMPTY_FILTERS)
    const [selectedItem,    setSelectedItem    ] = useState<Motorcycle | SparePart | Accessory | null>(null)

    function setF<K extends keyof Filters>(key: K, val: Filters[K]) {
        setFilters(f => ({ ...f, [key]: val }))
    }
    function clearFilters() { setFilters(EMPTY_FILTERS) }

    const activeFilterCount = [
        filters.websiteStatus !== 'all',
        filters.brand !== '',
        filters.stockStatus !== 'all',
        filters.priceMin !== '' || filters.priceMax !== '',
        filters.mcType !== '', filters.warehouse !== '', filters.mcColour !== '',
        filters.spCategory !== '',
        filters.accType !== '', filters.accSize !== '', filters.accColour !== '',
    ].filter(Boolean).length

    async function handleDelete(id: string) {
        if (!confirm('Delete this item permanently? This cannot be undone.')) return
        await deleteItem(id)
    }

    const q = search.toLowerCase()

    // ── Apply search + all filters ────────────────────────────────────────────
    const filtered = (() => {
        // Base pool for this tab
        let items: BaseInventoryItem[] =
            category === 'motorcycles' ? motorcycles :
            category === 'spareParts'  ? spareParts  : accessories

        // Text search
        if (q) {
            items = category === 'motorcycles'
                ? (items as Motorcycle[]).filter(m => [m.name, m.brand, m.articleNumber, m.vin, m.vendor].some(f => f.toLowerCase().includes(q)))
                : category === 'spareParts'
                ? (items as SparePart[]).filter(s => [s.name, s.brand, s.articleNumber, s.category, s.vendor].some(f => f.toLowerCase().includes(q)))
                : (items as Accessory[]).filter(a => [a.name, a.brand, a.articleNumber, a.category, a.vendor, a.size ?? ''].some(f => f.toLowerCase().includes(q)))
        }

        // Website status
        if (filters.websiteStatus === 'listed')   items = items.filter(i => i.listedOnWebsite)
        if (filters.websiteStatus === 'unlisted') items = items.filter(i => !i.listedOnWebsite)

        // Brand
        if (filters.brand) items = items.filter(i => i.brand === filters.brand)

        // Stock status
        if (filters.stockStatus === 'instock')    items = items.filter(i => i.stock > i.reorderQty)
        if (filters.stockStatus === 'lowstock')   items = items.filter(i => i.stock > 0 && i.stock <= i.reorderQty)
        if (filters.stockStatus === 'outofstock') items = items.filter(i => i.stock === 0)

        // Price range
        if (filters.priceMin !== '') items = items.filter(i => i.sellingPrice >= parseFloat(filters.priceMin))
        if (filters.priceMax !== '') items = items.filter(i => i.sellingPrice <= parseFloat(filters.priceMax))

        // Motorcycle-specific
        if (category === 'motorcycles') {
            const mcs = items as Motorcycle[]
            if (filters.mcType)    items = mcs.filter(m => m.mcType    === filters.mcType)
            if (filters.warehouse) items = (items as Motorcycle[]).filter(m => m.warehouse === filters.warehouse)
            if (filters.mcColour)  items = (items as Motorcycle[]).filter(m => m.color?.toLowerCase().includes(filters.mcColour.toLowerCase()))
        }

        // Spare-part-specific
        if (category === 'spareParts' && filters.spCategory) {
            items = (items as SparePart[]).filter(s => s.category === filters.spCategory)
        }

        // Accessory-specific
        if (category === 'accessories') {
            if (filters.accType)   items = (items as Accessory[]).filter(a => a.category === filters.accType)
            if (filters.accSize)   items = (items as Accessory[]).filter(a => a.size === filters.accSize)
            if (filters.accColour) items = (items as Accessory[]).filter(a => a.color?.toLowerCase().includes(filters.accColour.toLowerCase()))
        }

        return items
    })()

    const allData: BaseInventoryItem[] =
        category === 'motorcycles' ? motorcycles : category === 'spareParts' ? spareParts : accessories

    // Unique brands for the brand dropdown (from the full tab data, not filtered)
    const uniqueBrands = [...new Set(allData.map(i => i.brand).filter(Boolean))].sort()

    // Unique sizes for accessories
    const uniqueSizes = category === 'accessories'
        ? [...new Set((accessories as Accessory[]).map(a => a.size).filter(Boolean) as string[])].sort()
        : []

    const pendingPOs  = lowStockAlerts.length
    const tabLabel    = TABS.find(t => t.id === category)?.label ?? ''

    return (
        <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 flex-1 h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
            <div className="brand-top-bar" />

            {/* Compact header — single row */}
            <div className="px-5 md:px-8 py-2.5 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="text-lg">🏍</span>
                        <h1 className="text-base font-bold text-slate-900">Inventory</h1>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold hidden sm:inline">· Lager</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {pendingPOs > 0 && (
                            <Link href="/inventory/low-stock" className="flex items-center gap-1 text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors">
                                ⚠ {pendingPOs} Low Stock
                            </Link>
                        )}
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
                        >
                            ⬆ Import
                        </button>

                        {/* Download dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowDownload(v => !v)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
                            >
                                ⬇ Download <span className="text-slate-400">▾</span>
                            </button>
                            {showDownload && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowDownload(false)} />
                                    <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-44 overflow-hidden">
                                        <div className="px-3 py-1.5 border-b border-slate-100">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                {tabLabel} · {filtered.length} items
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { downloadExcel(filtered, category); setShowDownload(false) }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] transition-colors"
                                        >
                                            <span>📊</span>
                                            <div className="text-left">
                                                <div className="font-semibold">Excel (.xlsx)</div>
                                                <div className="text-[10px] text-slate-400">Spreadsheet format</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => { downloadInventoryPDF(filtered, category); setShowDownload(false) }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] transition-colors"
                                        >
                                            <span>📄</span>
                                            <div className="text-left">
                                                <div className="font-semibold">PDF</div>
                                                <div className="text-[10px] text-slate-400">Print-ready</div>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors"
                        >
                            + Add Item
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 px-5 md:px-8 py-3 flex flex-col gap-2.5">

                {/* Summary Cards */}
                <SummaryCards data={allData} />

                {/* Sub-nav tabs + Search + Filter toggle */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg w-fit">
                        {TABS.map((tab) => {
                            const count = tab.id === 'motorcycles' ? motorcycles.length
                                : tab.id === 'spareParts'  ? spareParts.length
                                : tab.id === 'accessories' ? accessories.length
                                : lowStockAlerts.length
                            const isActive = tab.id === 'lowStock'
                                ? !!pathname?.endsWith('low-stock')
                                : tab.id === category
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                        isActive ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]'
                                        : tab.id === 'lowStock' && count > 0 ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-200 text-slate-500'
                                    }`}>{count}</span>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Filter toggle button */}
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            showFilters || activeFilterCount > 0
                                ? 'bg-[#FF6B2C]/10 border-[#FF6B2C]/30 text-[#FF6B2C]'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
                        </svg>
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="bg-[#FF6B2C] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {/* Result count */}
                    <span className="text-xs text-slate-400">
                        {filtered.length !== allData.length
                            ? <><span className="font-semibold text-slate-600">{filtered.length}</span> of {allData.length}</>
                            : <><span className="font-semibold text-slate-600">{allData.length}</span> items</>
                        }
                    </span>

                    <div className="ml-auto flex items-center gap-2">
                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                                Clear all
                            </button>
                        )}
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder={`Search ${tabLabel.toLowerCase()}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]/50 w-56 bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Filter panel */}
                {showFilters && (
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shrink-0">
                        {/* Row 1 — universal filters */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            <div>
                                <FLabel>Website</FLabel>
                                <select className={fSel} value={filters.websiteStatus} onChange={e => setF('websiteStatus', e.target.value as Filters['websiteStatus'])}>
                                    <option value="all">All products</option>
                                    <option value="listed">🌐 Listed only</option>
                                    <option value="unlisted">· Unlisted only</option>
                                </select>
                            </div>
                            <div>
                                <FLabel>Brand</FLabel>
                                <select className={fSel} value={filters.brand} onChange={e => setF('brand', e.target.value)}>
                                    <option value="">All brands</option>
                                    {uniqueBrands.map(b => <option key={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <FLabel>Stock Status</FLabel>
                                <select className={fSel} value={filters.stockStatus} onChange={e => setF('stockStatus', e.target.value as Filters['stockStatus'])}>
                                    <option value="all">All</option>
                                    <option value="instock">In stock</option>
                                    <option value="lowstock">Low stock</option>
                                    <option value="outofstock">Out of stock</option>
                                </select>
                            </div>
                            <div>
                                <FLabel>Price min (SEK)</FLabel>
                                <input type="number" className={fIn} placeholder="0" value={filters.priceMin} onChange={e => setF('priceMin', e.target.value)} />
                            </div>
                            <div>
                                <FLabel>Price max (SEK)</FLabel>
                                <input type="number" className={fIn} placeholder="∞" value={filters.priceMax} onChange={e => setF('priceMax', e.target.value)} />
                            </div>
                        </div>

                        {/* Row 2 — category-specific */}
                        {category === 'motorcycles' && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2.5 pt-2.5 border-t border-slate-100">
                                <div>
                                    <FLabel>MC Type</FLabel>
                                    <select className={fSel} value={filters.mcType} onChange={e => setF('mcType', e.target.value)}>
                                        <option value="">All types</option>
                                        <option>New</option>
                                        <option>Trade-In</option>
                                        <option>Commission</option>
                                    </select>
                                </div>
                                <div>
                                    <FLabel>Warehouse</FLabel>
                                    <select className={fSel} value={filters.warehouse} onChange={e => setF('warehouse', e.target.value)}>
                                        <option value="">All warehouses</option>
                                        <option>Warehouse A</option>
                                        <option>Warehouse B</option>
                                        <option>Warehouse C</option>
                                        <option>Warehouse D</option>
                                    </select>
                                </div>
                                <div>
                                    <FLabel>Colour</FLabel>
                                    <input type="text" className={fIn} placeholder="e.g. Black, Red…" value={filters.mcColour} onChange={e => setF('mcColour', e.target.value)} />
                                </div>
                            </div>
                        )}

                        {category === 'spareParts' && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2.5 pt-2.5 border-t border-slate-100">
                                <div>
                                    <FLabel>Category</FLabel>
                                    <select className={fSel} value={filters.spCategory} onChange={e => setF('spCategory', e.target.value)}>
                                        <option value="">All categories</option>
                                        <optgroup label="Powertrain">
                                            {['Engine','Transmission','Fuel System','Exhaust'].map(c => <option key={c}>{c}</option>)}
                                        </optgroup>
                                        <optgroup label="Chassis & Safety">
                                            {['Suspension','Brakes','Tyres & Wheels','Controls & Cables'].map(c => <option key={c}>{c}</option>)}
                                        </optgroup>
                                        <optgroup label="Electrical & Instruments">
                                            {['Electrical','Lighting','Instruments'].map(c => <option key={c}>{c}</option>)}
                                        </optgroup>
                                        <optgroup label="Body & Ancillaries">
                                            {['Body & Frame','Cooling System','Filters & Fluids'].map(c => <option key={c}>{c}</option>)}
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                        )}

                        {category === 'accessories' && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2.5 pt-2.5 border-t border-slate-100">
                                <div>
                                    <FLabel>Type</FLabel>
                                    <select className={fSel} value={filters.accType} onChange={e => setF('accType', e.target.value)}>
                                        <option value="">All types</option>
                                        <optgroup label="Helmets"><option>Helmet</option></optgroup>
                                        <optgroup label="Clothing">
                                            {['Jacket','Gloves','T-Shirt','Pants','Boots','Cap','Neck & Face'].map(c => <option key={c}>{c}</option>)}
                                        </optgroup>
                                        <optgroup label="Other">
                                            {['Seat Cover','Protection','Luggage','Handlebars & Grips'].map(c => <option key={c}>{c}</option>)}
                                        </optgroup>
                                    </select>
                                </div>
                                <div>
                                    <FLabel>Size</FLabel>
                                    <select className={fSel} value={filters.accSize} onChange={e => setF('accSize', e.target.value)}>
                                        <option value="">All sizes</option>
                                        {uniqueSizes.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <FLabel>Colour</FLabel>
                                    <input type="text" className={fIn} placeholder="e.g. Black, Blue…" value={filters.accColour} onChange={e => setF('accColour', e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Table */}
                <div className="table-scroll bg-white rounded-2xl border border-slate-200 overflow-auto flex-1 min-h-0">
                    {category === 'motorcycles' && (
                        (filtered as Motorcycle[]).length > 0
                            ? <MotorcycleTable data={filtered as Motorcycle[]} updateStock={updateStock} toggleListing={toggleListing} onRowClick={setSelectedItem} onDelete={handleDelete} />
                            : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== '' || activeFilterCount > 0} />
                    )}
                    {category === 'spareParts' && (
                        (filtered as SparePart[]).length > 0
                            ? <SparePartsTable data={filtered as SparePart[]} updateStock={updateStock} toggleListing={toggleListing} onRowClick={setSelectedItem} onDelete={handleDelete} />
                            : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== '' || activeFilterCount > 0} />
                    )}
                    {category === 'accessories' && (
                        (filtered as Accessory[]).length > 0
                            ? <AccessoriesTable data={filtered as Accessory[]} updateStock={updateStock} toggleListing={toggleListing} onRowClick={setSelectedItem} onDelete={handleDelete} />
                            : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== '' || activeFilterCount > 0} />
                    )}
                </div>

            </div>

            {showAddModal    && <AddItemModal onClose={() => setShowAddModal(false)} />}
            {showImportModal && <ImportInventoryModal onClose={() => setShowImportModal(false)} />}
            {selectedItem   && <EditItemModal item={selectedItem} category={category} onClose={() => setSelectedItem(null)} />}
        </div>
        </div>
    )
}
