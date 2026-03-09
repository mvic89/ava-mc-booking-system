'use client'

import { useState } from 'react'
import { vendorDetails } from '@/data/vendors'
import { POLineItem, POStatus, PurchaseOrder } from '@/utils/types'

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-MY', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
    }).format(value)
}

export function qtyKey(poId: string, inventoryId: string) {
    return `${poId}:${inventoryId}`
}

export const STATUS_STYLE: Record<POStatus, { dot: string; badge: string }> = {
    'Draft':        { dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600' },
    'Under Review': { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    'Approved':     { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700' },
    'Reviewed':     { dot: 'bg-teal-500',   badge: 'bg-teal-50 text-teal-700 border border-teal-200' },
    'Sent':         { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700' },
    'Received':     { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700' },
}

// Vendor item shape passed from the page
export interface VendorItem {
    id: string
    name: string
    articleNumber: string
    cost: number
    size?: string
}

// ─── POModal ──────────────────────────────────────────────────────────────────

export function POModal({
    po,
    isAuto,
    qtyOverrides,
    onAdjust,
    onClose,
    onSent,
    onReviewed,
    vendorItems = [],
    zIndex = 'z-50',
    freeShippingThreshold,
}: {
    po: PurchaseOrder
    isAuto: boolean
    qtyOverrides: Record<string, number>
    onAdjust: (poId: string, inventoryId: string, delta: number) => void
    onClose: () => void
    onSent?: () => void
    onReviewed?: (items: POLineItem[], eta: string) => void
    vendorItems?: VendorItem[]
    zIndex?: string
    freeShippingThreshold?: number
}) {
    // ── Review mode state ───────────────────────────────────────────────────
    const [reviewMode, setReviewMode] = useState(false)
    const [editedEta,  setEditedEta]  = useState(po.eta)

    // editedItems is initialized once with effective quantities applied
    const [editedItems, setEditedItems] = useState<POLineItem[]>(() =>
        po.items.map((li) => {
            const qty = qtyOverrides[qtyKey(po.id, li.inventoryId)] ?? li.orderQty
            return { ...li, orderQty: qty, lineTotal: qty * li.unitCost }
        })
    )

    // Add-item search state
    const [addSearch,  setAddSearch]  = useState('')
    const [addOpen,    setAddOpen]    = useState(false)

    // Email send state
    const [sending,     setSending]     = useState(false)
    const [emailStatus, setEmailStatus] = useState<'idle' | 'sent' | 'error'>('idle')

    const style       = STATUS_STYLE[po.status]
    const vendor      = vendorDetails[po.vendor]
    const vendorEmail = vendor?.email ?? ''

    // Sent and Received POs are fully locked — no editing allowed
    const isSent = po.status === 'Sent' || po.status === 'Received'

    // In review mode use editedItems; otherwise use po.items + qtyOverrides
    const displayItems = reviewMode
        ? editedItems
        : po.items.map((li) => {
              const qty = qtyOverrides[qtyKey(po.id, li.inventoryId)] ?? li.orderQty
              return { ...li, orderQty: qty, lineTotal: qty * li.unitCost }
          })

    const grandTotal = displayItems.reduce((s, li) => s + li.lineTotal, 0)

    // ── Review mode helpers ─────────────────────────────────────────────────

    function adjustReviewQty(inventoryId: string, delta: number) {
        setEditedItems((prev) =>
            prev.map((li) => {
                if (li.inventoryId !== inventoryId) return li
                const qty = Math.max(1, li.orderQty + delta)
                return { ...li, orderQty: qty, lineTotal: qty * li.unitCost }
            })
        )
    }

    function addReviewItem(item: VendorItem) {
        // Prevent duplicate
        if (editedItems.some((li) => li.inventoryId === item.id)) return
        const newLine: POLineItem = {
            inventoryId:   item.id,
            name:          item.name,
            articleNumber: item.articleNumber,
            orderQty:      1,
            unitCost:      item.cost,
            lineTotal:     item.cost,
            size:          item.size,
        }
        setEditedItems((prev) => [...prev, newLine])
        setAddSearch('')
        setAddOpen(false)
    }

    function handleDone() {
        onReviewed?.(editedItems, editedEta)
    }

    // ── Date helpers ─────────────────────────────────────────────────────────

    function toInputDate(val: string): string {
        if (!val || val === '—') return ''
        const d = new Date(val)
        if (isNaN(d.getTime())) return ''
        const y  = d.getFullYear()
        const mo = String(d.getMonth() + 1).padStart(2, '0')
        const dy = String(d.getDate()).padStart(2, '0')
        return `${y}-${mo}-${dy}`
    }

    function toDisplayDate(iso: string): string {
        if (!iso) return '—'
        const [y, mo, dy] = iso.split('-').map(Number)
        return new Date(y, mo - 1, dy).toLocaleDateString('en-MY', {
            day: 'numeric', month: 'short', year: 'numeric',
        })
    }

    // Vendor items not yet in the PO
    const existingIds   = new Set(editedItems.map((li) => li.inventoryId))
    const availableItems = vendorItems.filter(
        (vi) => !existingIds.has(vi.id) &&
                vi.name.toLowerCase().includes(addSearch.toLowerCase())
    )

    // ── PDF + Email ─────────────────────────────────────────────────────────

    async function generateAndEmailPDF() {
        setSending(true)
        setEmailStatus('idle')

        try {
            const { default: jsPDF } = await import('jspdf')
            const { default: autoTable } = await import('jspdf-autotable')

            const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            const pageW  = doc.internal.pageSize.getWidth()
            const pageH  = doc.internal.pageSize.getHeight()
            const navy   = [30, 58, 95]   as [number, number, number]
            const gold   = [180, 140, 60] as [number, number, number]
            const margin = 14

            // ── Header band ──────────────────────────────────────────────
            doc.setFillColor(...navy)
            doc.rect(0, 0, pageW, 38, 'F')
            doc.setTextColor(147, 197, 253)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.text('AVA MOTORCYCLE CENTRE', margin, 10)
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(20)
            doc.text('PURCHASE ORDER', margin, 22)
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(147, 197, 253)
            doc.text(po.id, pageW - margin, 22, { align: 'right' })
            doc.setDrawColor(...gold)
            doc.setLineWidth(0.8)
            doc.line(0, 38, pageW, 38)

            // ── Meta strip ───────────────────────────────────────────────
            doc.setTextColor(80, 80, 80)
            doc.setFontSize(8.5)
            doc.setFont('helvetica', 'normal')
            doc.text(`Date Issued: ${po.date}`, margin, 46)
            if (editedEta && editedEta !== '—') {
                doc.text(`Expected Delivery: ${editedEta}`, margin + 65, 46)
            }
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...navy)
            doc.text(`Status: Sent`, pageW - margin, 46, { align: 'right' })
            doc.setDrawColor(220, 220, 220)
            doc.setLineWidth(0.3)
            doc.line(margin, 50, pageW - margin, 50)

            // ── Two-column: FROM / VENDOR ─────────────────────────────────
            const colMid = pageW / 2 + 4
            let blockY   = 56

            doc.setFontSize(6.5)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...navy)
            doc.text('FROM', margin, blockY)
            doc.setFontSize(9)
            doc.setTextColor(20, 20, 20)
            doc.text('AVA Motorcycle Centre', margin, blockY + 5)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(80, 80, 80)
            doc.text('Procurement Department', margin, blockY + 10)
            doc.text('Kuala Lumpur, Malaysia', margin, blockY + 15)
            doc.text('procurement@avamotorcycle.com', margin, blockY + 20)

            doc.setFontSize(6.5)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...navy)
            doc.text('BILL TO / VENDOR', colMid, blockY)
            doc.setFontSize(9)
            doc.setTextColor(20, 20, 20)
            doc.text(po.vendor, colMid, blockY + 5, { maxWidth: pageW - colMid - margin })
            if (vendor) {
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7.5)
                doc.setTextColor(80, 80, 80)
                const addrLines = doc.splitTextToSize(vendor.address, pageW - colMid - margin)
                doc.text(addrLines, colMid, blockY + 10)
                const afterAddr = blockY + 10 + addrLines.length * 4
                doc.text(`Ph: ${vendor.phone}`, colMid, afterAddr)
                doc.text(`Email: ${vendor.email}`, colMid, afterAddr + 4.5)
            }

            blockY += 30
            doc.setDrawColor(220, 220, 220)
            doc.setLineWidth(0.3)
            doc.line(margin, blockY, pageW - margin, blockY)

            // ── Items table — use editedItems ─────────────────────────────
            const tableRows = editedItems.map((li) => [
                li.articleNumber,
                li.name,
                String(li.orderQty),
                formatCurrency(li.unitCost),
                formatCurrency(li.lineTotal),
            ])
            const pdfTotal = editedItems.reduce((s, li) => s + li.lineTotal, 0)

            autoTable(doc, {
                startY: blockY + 3,
                head: [['Article No.', 'Item Description', 'Qty', 'Unit Cost', 'Line Total']],
                body: tableRows,
                foot: [
                    ['', '', '', 'Subtotal',    formatCurrency(pdfTotal)],
                    ['', '', '', 'Tax (0%)',    formatCurrency(0)],
                    ['', '', '', 'GRAND TOTAL', formatCurrency(pdfTotal)],
                ],
                styles:             { fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 } },
                headStyles:         { fillColor: navy, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
                bodyStyles:         { textColor: [40, 40, 40] },
                alternateRowStyles: { fillColor: [246, 248, 252] },
                footStyles:         { fillColor: [240, 244, 250], textColor: navy, fontStyle: 'bold', fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 30, textColor: [100, 100, 100] },
                    2: { halign: 'center', cellWidth: 16 },
                    3: { halign: 'right',  cellWidth: 32 },
                    4: { halign: 'right',  cellWidth: 32 },
                },
                didParseCell(data) {
                    if (data.section === 'foot' && data.row.index === 2) {
                        data.cell.styles.fillColor = navy
                        data.cell.styles.textColor = [255, 255, 255]
                        data.cell.styles.fontSize  = 8.5
                    }
                },
            })

            type DocWithTable = InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }
            let curY = (doc as DocWithTable).lastAutoTable.finalY + 8

            // ── Notes ────────────────────────────────────────────────────
            if (po.notes) {
                doc.setFillColor(255, 251, 235)
                doc.setDrawColor(253, 230, 138)
                doc.roundedRect(margin, curY, pageW - margin * 2, 12, 1.5, 1.5, 'FD')
                doc.setFontSize(7.5)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(120, 80, 0)
                doc.text('Note:', margin + 3, curY + 5)
                doc.setFont('helvetica', 'normal')
                doc.text(po.notes, margin + 14, curY + 5, { maxWidth: pageW - margin * 2 - 18 })
                curY += 18
            }

            // ── Terms & Conditions ───────────────────────────────────────
            doc.setFillColor(246, 248, 252)
            doc.setDrawColor(203, 213, 225)
            doc.roundedRect(margin, curY, pageW - margin * 2, 38, 2, 2, 'FD')
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...navy)
            doc.text('TERMS & CONDITIONS', margin + 4, curY + 6)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(70, 70, 70)
            const terms = [
                '1. Payment Terms: Net 30 days from invoice date unless otherwise agreed in writing.',
                '2. Delivery: Goods must be delivered to the address specified. Partial deliveries must be notified in advance.',
                "3. Quality: All items must conform to agreed specifications. Non-conforming goods will be returned at supplier's cost.",
                '4. Cancellation: AVA Motorcycle Centre reserves the right to cancel this order if delivery date is not met.',
                '5. Acceptance: This PO is subject to acceptance by the vendor within 3 business days of receipt.',
            ]
            terms.forEach((line, i) => {
                doc.text(line, margin + 4, curY + 13 + i * 5.5, { maxWidth: pageW - margin * 2 - 8 })
            })

            // ── Footer band ───────────────────────────────────────────────
            doc.setFillColor(...navy)
            doc.rect(0, pageH - 12, pageW, 12, 'F')
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(147, 197, 253)
            doc.text('AVA Motorcycle Centre — Procurement Department', margin, pageH - 4.5)
            doc.setTextColor(200, 200, 200)
            doc.text(
                `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                pageW - margin, pageH - 4.5, { align: 'right' },
            )

            const pdfBase64 = doc.output('datauristring')

            const res = await fetch('/api/send-po-email', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail:    vendorEmail,
                    poId:       po.id,
                    vendorName: po.vendor,
                    poDate:     po.date,
                    eta:        editedEta,
                    pdfBase64,
                }),
            })

            if (!res.ok) {
                const { error } = await res.json()
                throw new Error(error ?? 'Unknown error')
            }

            setEmailStatus('sent')
            // Change status to Sent and close modal after short delay
            setTimeout(() => { onSent?.() }, 1500)

        } catch (err) {
            console.error('Export/Email error:', err)
            setEmailStatus('error')
        } finally {
            setSending(false)
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div
            className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Modal Header ─────────────────────────────────────────── */}
                <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                                Purchase Order
                            </h2>
                            {isAuto && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                    AUTO
                                </span>
                            )}
                            {reviewMode && (
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                    REVIEW MODE
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-gray-900 font-mono">{po.id}</span>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                {po.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                            <span>Date: <span className="text-gray-600 font-medium">{po.date}</span></span>
                            {editedEta !== '—' && (
                                <span>ETA: <span className="text-gray-600 font-medium">{editedEta}</span></span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0 mt-1"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Scrollable body ─────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

                    {/* Vendor card */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
                            Vendor
                        </div>
                        <div className="font-bold text-gray-800 text-sm mb-1">{po.vendor}</div>
                        {vendor ? (
                            <div className="text-xs text-gray-500 space-y-0.5">
                                <div>{vendor.address}</div>
                                <div className="flex flex-wrap items-center gap-4 pt-0.5">
                                    <span>📞 {vendor.phone}</span>
                                    <span>🏢 {vendor.orgNumber}</span>
                                    <span>📧 {vendor.email}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 italic">No contact details on file</div>
                        )}
                    </div>

                    {/* Free shipping caution */}
                    {freeShippingThreshold != null && grandTotal < freeShippingThreshold && (
                        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                            <span className="text-yellow-500 text-base shrink-0 mt-0.5">⚠️</span>
                            <div className="text-sm text-yellow-800">
                                <span className="font-semibold">Below free shipping threshold — </span>
                                this PO total is <span className="font-semibold">{formatCurrency(grandTotal)}</span>.{' '}
                                {po.vendor} offers free shipping on orders over{' '}
                                <span className="font-semibold">{formatCurrency(freeShippingThreshold)}</span>.{' '}
                                Consider adding more items to qualify.
                            </div>
                        </div>
                    )}

                    {/* Date of Delivery — editable in review mode */}
                    {reviewMode && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                            <div className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold mb-2">
                                Date of Delivery
                            </div>
                            <input
                                type="date"
                                value={toInputDate(editedEta)}
                                onChange={(e) => setEditedEta(toDisplayDate(e.target.value))}
                                className="text-sm font-medium text-gray-800 bg-white border border-orange-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-400"
                            />
                        </div>
                    )}

                    {/* Items section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                                Items ({displayItems.length})
                            </div>
                            {reviewMode && (
                                <div className="text-[10px] text-orange-600 font-semibold">
                                    Editing — changes apply to the exported PDF
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-left text-xs uppercase text-gray-400 tracking-wider border-b border-gray-200">
                                        <th className="px-4 py-2.5 font-semibold">Article No.</th>
                                        <th className="px-4 py-2.5 font-semibold">Item Name</th>
                                        <th className="px-4 py-2.5 text-center font-semibold">Size</th>
                                        <th className="px-4 py-2.5 text-center font-semibold">Order Qty</th>
                                        <th className="px-4 py-2.5 text-right font-semibold">Unit Cost</th>
                                        <th className="px-4 py-2.5 text-right font-semibold">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayItems.map((li) => (
                                        <tr key={li.inventoryId} className="hover:bg-orange-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{li.articleNumber}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-gray-800 text-sm">{li.name}</div>
                                                <div className="text-xs text-blue-500 font-mono mt-0.5">{li.inventoryId}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {li.size
                                                    ? <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">{li.size}</span>
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">
                                                {isSent ? (
                                                    <div className="text-center font-bold text-gray-800 tabular-nums">{li.orderQty}</div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => reviewMode ? adjustReviewQty(li.inventoryId, -1) : onAdjust(po.id, li.inventoryId, -1)}
                                                            className="w-6 h-6 rounded-md bg-red-100 hover:bg-red-200 text-red-600 font-bold flex items-center justify-center text-sm transition-colors"
                                                        >−</button>
                                                        <span className="w-9 text-center font-bold text-gray-800 tabular-nums">{li.orderQty}</span>
                                                        <button
                                                            onClick={() => reviewMode ? adjustReviewQty(li.inventoryId, 1) : onAdjust(po.id, li.inventoryId, 1)}
                                                            className="w-6 h-6 rounded-md bg-green-100 hover:bg-green-200 text-green-600 font-bold flex items-center justify-center text-sm transition-colors"
                                                        >+</button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 text-sm">{formatCurrency(li.unitCost)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm">{formatCurrency(li.lineTotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                                        <td colSpan={5} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                                            Grand Total
                                        </td>
                                        <td className="px-4 py-3 text-right text-base font-bold text-gray-900">
                                            {formatCurrency(grandTotal)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* ── Add Item (review mode only) ─────────────────── */}
                        {reviewMode && (
                            <div className="mt-3 relative">
                                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
                                    <span className="text-orange-500 text-sm">＋</span>
                                    <input
                                        type="text"
                                        placeholder="Search to add item from this vendor…"
                                        value={addSearch}
                                        onChange={(e) => { setAddSearch(e.target.value); setAddOpen(true) }}
                                        onFocus={() => setAddOpen(true)}
                                        className="flex-1 bg-transparent text-sm text-gray-700 placeholder-orange-300 outline-none"
                                    />
                                </div>

                                {addOpen && (addSearch.length > 0 || availableItems.length > 0) && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-44 overflow-y-auto">
                                        {availableItems.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-gray-400 italic">
                                                {addSearch ? 'No matching items' : 'All vendor items already added'}
                                            </div>
                                        ) : (
                                            availableItems.map((vi) => (
                                                <button
                                                    key={vi.id}
                                                    onClick={() => addReviewItem(vi)}
                                                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-0"
                                                >
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-800">{vi.name}</div>
                                                        <div className="text-xs text-gray-400 font-mono">{vi.articleNumber}</div>
                                                    </div>
                                                    <div className="text-sm font-semibold text-gray-600 ml-4 shrink-0">
                                                        {formatCurrency(vi.cost)}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    {po.notes && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
                            <span className="font-semibold text-amber-700">Notes: </span>{po.notes}
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────────────────────── */}
                <div className="px-7 py-4 border-t border-gray-100 shrink-0">
                    {/* Email status feedback */}
                    {emailStatus !== 'idle' && (
                        <div className={`mb-3 text-sm font-medium rounded-lg px-4 py-2 ${
                            emailStatus === 'sent'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {emailStatus === 'sent'
                                ? `✓ Email sent to ${vendorEmail} — status updated to Sent`
                                : '✗ Failed to send — check EMAIL_USER / EMAIL_PASS in .env.local'}
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                        {reviewMode ? (
                            /* ── Review mode footer ── */
                            <>
                                <button
                                    onClick={() => { setReviewMode(false); setAddOpen(false); setAddSearch('') }}
                                    className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                                >
                                    ✕ Cancel
                                </button>
                                <button
                                    onClick={handleDone}
                                    disabled={editedItems.length === 0}
                                    className="px-5 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                                >
                                    ✓ Done
                                </button>
                            </>
                        ) : (
                            /* ── Normal view footer ── */
                            <>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                                >
                                    Close
                                </button>

                                <div className="flex items-center gap-2">
                                    {isSent ? (
                                        <span className="text-xs font-semibold text-purple-600 flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                                            🔒 {po.status} — view only
                                        </span>
                                    ) : (
                                        <>
                                            <button
                                                onClick={generateAndEmailPDF}
                                                disabled={sending || displayItems.length === 0}
                                                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                {sending ? (
                                                    <>
                                                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Sending…
                                                    </>
                                                ) : (
                                                    '📄 Export & Email PO'
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setReviewMode(true)}
                                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                                            >
                                                ✏️ Review
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
