'use client'

import { useState, useRef, useCallback } from 'react'

// ── Column resize + drag-to-reorder hook ──────────────────────────────────────

export function useColumnState(defaultWidths: number[]) {
    const [widths,      setWidths     ] = useState<number[]>(defaultWidths)
    const [order,       setOrder      ] = useState<number[]>(() => defaultWidths.map((_, i) => i))
    const [draggingPos, setDraggingPos] = useState<number | null>(null)
    const [dragOverPos, setDragOverPos] = useState<number | null>(null)
    const dragFrom  = useRef<number | null>(null)
    const resizing  = useRef<{ pos: number; startX: number; startW: number } | null>(null)

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

// ── Draggable + resizable column header ───────────────────────────────────────

export function ColTh({ pos, width, isDragging, isDragOver, isLast, onResizeMouseDown, onDragStart, onDragOver, onDrop, onDragEnd, children }: {
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
            <span
                onMouseDown={e => onResizeMouseDown(pos, e)}
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#FF6B2C]/60 transition-colors z-10"
            />
        </th>
    )
}

// ── Column definition type ────────────────────────────────────────────────────

export type ColDef<T> = {
    label: string
    defaultWidth: number
    tdClass?: string
    noClick?: boolean
    cell: (item: T) => React.ReactNode
}

// ── Generic reorderable table ─────────────────────────────────────────────────

export function ReorderableTable<T>({ cols, data, defaultWidths, onRowClick, rowKey }: {
    cols: ColDef<T>[]
    data: T[]
    defaultWidths: number[]
    onRowClick: (item: T) => void
    rowKey: (item: T, idx: number) => string
}) {
    const { widths, order, draggingPos, dragOverPos, onResizeMouseDown, onDragStart, onDragOver, onDrop, onDragEnd } = useColumnState(defaultWidths)
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
                        key={rowKey(item, rowIdx)}
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
                                    {col.cell(item)}
                                </td>
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
