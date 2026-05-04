'use client'

import { useState } from 'react'
import { vendorDetails } from '@/data/vendors'
import { getDealershipProfile, getDealershipId } from '@/lib/tenant'
import { POLineItem, POStatus, POApprovalStatus, POPlacementOutcome, PurchaseOrder } from '@/utils/types'

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
    'Draft':    { dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600' },
    'Reviewed': { dot: 'bg-teal-500',   badge: 'bg-teal-50 text-teal-700 border border-teal-200' },
    'Sent':     { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700' },
    'Received': { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700' },
}

const APPROVAL_STYLE: Record<POApprovalStatus, { badge: string; label: string }> = {
    pending_approval: { badge: 'bg-amber-100 text-amber-700 border border-amber-300', label: '🔐 Pending Approval' },
    approved:         { badge: 'bg-green-100 text-green-700 border border-green-300',  label: '✓ Approved'         },
    rejected:         { badge: 'bg-red-100 text-red-700 border border-red-300',        label: '✗ Rejected'         },
}

const PLACEMENT_LABEL: Record<POPlacementOutcome, string> = {
    confirmed:      '✓ Confirmed',
    backordered:    '⏳ Backordered',
    credit_blocked: '🚫 Credit Blocked',
    substituted:    '↔ Substituted',
}

const PLACEMENT_BADGE: Record<POPlacementOutcome, string> = {
    confirmed:      'bg-green-50 text-green-700 border border-green-200',
    backordered:    'bg-yellow-50 text-yellow-700 border border-yellow-200',
    credit_blocked: 'bg-red-50 text-red-700 border border-red-200',
    substituted:    'bg-blue-50 text-blue-700 border border-blue-200',
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
    onMarkOrdered,
    onApprove,
    onReject,
    vendorItems = [],
    zIndex = 'z-50',
    freeShippingThreshold,
    vendorEmailOverride,
}: {
    po: PurchaseOrder
    isAuto: boolean
    qtyOverrides: Record<string, number>
    onAdjust: (poId: string, inventoryId: string, delta: number) => void
    onClose: () => void
    onSent?: () => void
    onReviewed?: (items: POLineItem[], eta: string) => void
    /** Called when user confirms "I've placed this order on the supplier portal" */
    onMarkOrdered?: (poId: string, orderRef: string, outcome: POPlacementOutcome, notes: string) => void
    onApprove?: (poId: string) => void
    onReject?: (poId: string, note: string) => void
    vendorItems?: VendorItem[]
    zIndex?: string
    freeShippingThreshold?: number
    vendorEmailOverride?: string
}) {
    // ── Review mode state ───────────────────────────────────────────────────
    const [reviewMode, setReviewMode] = useState(false)
    const [editedEta,  setEditedEta]  = useState(po.eta)

    // ── "Mark as Ordered on Portal" inline form ─────────────────────────────
    const [markOrderedOpen,    setMarkOrderedOpen]    = useState(false)
    const [portalOrderRefInput, setPortalOrderRefInput] = useState('')

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
    const [sending,      setSending]      = useState(false)
    const [emailStatus,  setEmailStatus]  = useState<'idle' | 'sent' | 'error'>('idle')
    const [emailError,   setEmailError]   = useState<string>('')
    const [downloading,  setDownloading]  = useState(false)

    // Portal placement outcome state
    const [portalOutcome,      setPortalOutcome]      = useState<POPlacementOutcome>('confirmed')
    const [portalNotes,        setPortalNotes]        = useState('')
    const [backorderedItemIds, setBackorderedItemIds] = useState<Set<string>>(new Set())
    const [backorderedETA,     setBackorderedETA]     = useState('')

    // Reject flow state
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectNote, setRejectNote] = useState('')

    const style       = STATUS_STYLE[po.status] ?? STATUS_STYLE['Draft']
    const vendor      = vendorDetails[po.vendor]
    // Prefer Supabase email (passed from parent); fall back to static vendorDetails
    const vendorEmail = vendorEmailOverride ?? vendor?.email ?? ''

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

    // ── Backordered item highlighting ───────────────────────────────────────
    // Parse article numbers from stored placement_notes string:
    // "Backordered: Item A (ART-001) ×5, Item B [XL] (ART-002) ×2. New ETA: ..."
    const backorderedArticleNos: Set<string> = (() => {
        if (po.placementOutcome !== 'backordered' || !po.placementNotes) return new Set()
        const matches = [...po.placementNotes.matchAll(/\(([^)]+)\)/g)]
        return new Set(matches.map((m) => m[1].trim()))
    })()

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
        onClose()
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

    // ── PDF builder (shared) ─────────────────────────────────────────────────

    async function buildPODoc() {
        const dealer = getDealershipProfile()
        const { default: jsPDF }     = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')

        const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pageW  = doc.internal.pageSize.getWidth()
        const pageH  = doc.internal.pageSize.getHeight()
        const navy   = [30, 58, 95]   as [number, number, number]
        const gold   = [180, 140, 60] as [number, number, number]
        const margin = 14

        doc.setFillColor(...navy)
        doc.rect(0, 0, pageW, 38, 'F')
        doc.setTextColor(147, 197, 253)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.text((dealer.name || 'PROCUREMENT').toUpperCase(), margin, 10)
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

        doc.setTextColor(80, 80, 80)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.text(`Date Issued: ${po.date}`, margin, 46)
        if (editedEta && editedEta !== '—') {
            doc.text(`Expected Delivery: ${editedEta}`, margin + 65, 46)
        }
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...navy)
        doc.text(`Status: ${po.status}`, pageW - margin, 46, { align: 'right' })
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, 50, pageW - margin, 50)

        const colMid = pageW / 2 + 4
        let blockY   = 56

        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...navy)
        doc.text('FROM', margin, blockY)
        doc.setFontSize(9)
        doc.setTextColor(20, 20, 20)
        doc.text(dealer.name || 'Our Company', margin, blockY + 5)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(80, 80, 80)
        doc.text('Procurement Department', margin, blockY + 10)
        if (dealer.address) doc.text(dealer.address, margin, blockY + 15)
        if (dealer.email)   doc.text(dealer.email,   margin, blockY + 20)

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

        const tableRows = editedItems.map((li) => [
            li.articleNumber,
            li.size ? `${li.name}\nSize: ${li.size}` : li.name,
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

        doc.setFillColor(246, 248, 252)
        doc.setDrawColor(203, 213, 225)
        doc.roundedRect(margin, curY, pageW - margin * 2, 38, 2, 2, 'FD')
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...navy)
        doc.text('TERMS & CONDITIONS', margin + 4, curY + 6)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(70, 70, 70)
        const dealerName = dealer.name || 'The Buyer'
        const terms = [
            '1. Payment Terms: Net 30 days from invoice date unless otherwise agreed in writing.',
            '2. Delivery: Goods must be delivered to the address specified. Partial deliveries must be notified in advance.',
            `3. Quality: All items must conform to agreed specifications. Non-conforming goods will be returned at supplier's cost.`,
            `4. Cancellation: ${dealerName} reserves the right to cancel this order if delivery date is not met.`,
            '5. Acceptance: This PO is subject to acceptance by the vendor within 3 business days of receipt.',
        ]
        terms.forEach((line, i) => {
            doc.text(line, margin + 4, curY + 13 + i * 5.5, { maxWidth: pageW - margin * 2 - 8 })
        })

        doc.setFillColor(...navy)
        doc.rect(0, pageH - 12, pageW, 12, 'F')
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(147, 197, 253)
        doc.text(`${dealer.name || 'Procurement'} — Procurement Department`, margin, pageH - 4.5)
        doc.setTextColor(200, 200, 200)
        doc.text(
            `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
            pageW - margin, pageH - 4.5, { align: 'right' },
        )

        return { doc, dealer }
    }

    // ── Download PDF ─────────────────────────────────────────────────────────

    async function downloadPDF() {
        setDownloading(true)
        try {
            const { doc } = await buildPODoc()
            doc.save(`${po.id}.pdf`)
        } catch (err) {
            console.error('Download error:', err)
        } finally {
            setDownloading(false)
        }
    }

    // ── PDF + Email ─────────────────────────────────────────────────────────

    async function generateAndEmailPDF() {
        setSending(true)
        setEmailStatus('idle')

        try {
            const { doc, dealer } = await buildPODoc()
            const pdfBase64 = doc.output('datauristring')

            const res = await fetch('/api/send-po-email', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail:       vendorEmail,
                    poId:          po.id,
                    vendorName:    po.vendor,
                    poDate:        po.date,
                    eta:           editedEta,
                    pdfBase64,
                    fromName:      dealer.name  || 'Procurement',
                    replyTo:       dealer.email || undefined,
                    dealerPhone:   dealer.phone || undefined,
                    dealershipId:  getDealershipId() ?? undefined,
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
            setEmailError(err instanceof Error ? err.message : 'Unknown error')
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
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-2xl font-bold text-gray-900 font-mono">{po.id}</span>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                {po.status}
                            </span>
                            {po.approvalStatus && (
                                <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${APPROVAL_STYLE[po.approvalStatus].badge}`}>
                                    {APPROVAL_STYLE[po.approvalStatus].label}
                                </span>
                            )}
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

                        {/* Portal order details — shown once the order has been placed */}
                        {(po.supplierOrderRef || po.placedAt) && (
                            <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-3">
                                {po.supplierOrderRef && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Portal Ref</span>
                                        <span className="font-mono text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                                            {po.supplierOrderRef}
                                        </span>
                                    </div>
                                )}
                                {po.placedAt && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Placed</span>
                                        <span className="text-xs text-gray-600 font-medium">
                                            {new Date(po.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                )}
                                {po.placementOutcome && (
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLACEMENT_BADGE[po.placementOutcome]}`}>
                                        {PLACEMENT_LABEL[po.placementOutcome]}
                                    </span>
                                )}
                            </div>
                        )}
                        {po.placementNotes && (
                            <div className="mt-2 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2 italic">
                                {po.placementNotes}
                            </div>
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
                                    {displayItems.map((li, idx) => {
                                        const isBackordered = backorderedArticleNos.has(li.articleNumber)
                                        return (
                                        <tr key={`${li.inventoryId}-${idx}`} className={`transition-colors ${isBackordered ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400' : 'hover:bg-orange-50'}`}>
                                            <td className={`px-4 py-3 font-mono text-xs ${isBackordered ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{li.articleNumber}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-sm ${isBackordered ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{li.name}</span>
                                                    {isBackordered && (
                                                        <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full">
                                                            ⏳ Backordered
                                                        </span>
                                                    )}
                                                </div>
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
                                                    <div className={`text-center tabular-nums font-bold ${isBackordered ? 'text-gray-900' : 'text-gray-800'}`}>{li.orderQty}</div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => reviewMode ? adjustReviewQty(li.inventoryId, -1) : onAdjust(po.id, li.inventoryId, -1)}
                                                            className="w-6 h-6 rounded-md bg-red-100 hover:bg-red-200 text-red-600 font-bold flex items-center justify-center text-sm transition-colors"
                                                        >−</button>
                                                        <span className={`w-9 text-center font-bold tabular-nums ${isBackordered ? 'text-gray-900' : 'text-gray-800'}`}>{li.orderQty}</span>
                                                        <button
                                                            onClick={() => reviewMode ? adjustReviewQty(li.inventoryId, 1) : onAdjust(po.id, li.inventoryId, 1)}
                                                            className="w-6 h-6 rounded-md bg-green-100 hover:bg-green-200 text-green-600 font-bold flex items-center justify-center text-sm transition-colors"
                                                        >+</button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`px-4 py-3 text-right text-sm ${isBackordered ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{formatCurrency(li.unitCost)}</td>
                                            <td className={`px-4 py-3 text-right text-sm ${isBackordered ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{formatCurrency(li.lineTotal)}</td>
                                        </tr>
                                        )
                                    })}
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
                                : `✗ Failed to send${emailError ? ` — ${emailError}` : ''}`}
                        </div>
                    )}

                    {/* ── "Mark as Ordered on Portal" inline form ── */}
                    {markOrderedOpen && (
                        <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2.5">
                            <p className="text-xs font-semibold text-green-800">
                                Confirm order placed on supplier portal
                                {po.refNo && (
                                    <span className="ml-1 font-normal text-green-700">
                                        — use Ref No. <span className="font-mono font-bold">{po.refNo}</span>
                                    </span>
                                )}
                            </p>
                            {/* Outcome selector */}
                            <div className="flex flex-wrap gap-1.5">
                                {(['confirmed', 'backordered', 'credit_blocked', 'substituted'] as POPlacementOutcome[]).map((opt) => (
                                    <label key={opt} className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer border transition-colors ${
                                        portalOutcome === opt
                                            ? PLACEMENT_BADGE[opt]
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="portalOutcome"
                                            value={opt}
                                            checked={portalOutcome === opt}
                                            onChange={() => setPortalOutcome(opt)}
                                            className="sr-only"
                                        />
                                        {PLACEMENT_LABEL[opt]}
                                    </label>
                                ))}
                            </div>
                            {/* Backordered: item checklist + new ETA */}
                            {portalOutcome === 'backordered' && (
                                <div className="space-y-2">
                                    <p className="text-[10px] uppercase tracking-wider text-green-700 font-semibold">
                                        Select backordered items:
                                    </p>
                                    <div className="space-y-0.5 max-h-40 overflow-y-auto rounded-lg border border-green-200 bg-white px-2 py-1">
                                        {displayItems.map((li) => (
                                            <label
                                                key={`${li.inventoryId}-${li.size ?? ''}`}
                                                className="flex items-start gap-2.5 px-1.5 py-2 rounded-md hover:bg-green-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={backorderedItemIds.has(`${li.inventoryId}|${li.size ?? ''}`)}
                                                    onChange={(e) => {
                                                        const key = `${li.inventoryId}|${li.size ?? ''}`
                                                        setBackorderedItemIds((prev) => {
                                                            const next = new Set(prev)
                                                            if (e.target.checked) next.add(key)
                                                            else next.delete(key)
                                                            return next
                                                        })
                                                    }}
                                                    className="w-3.5 h-3.5 accent-green-600 shrink-0 mt-0.5"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold text-gray-800 leading-tight truncate">{li.name}</div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        <span className="font-mono text-[10px] text-gray-400">{li.articleNumber}</span>
                                                        {li.size && (
                                                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                                                                {li.size}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-gray-600 tabular-nums shrink-0 mt-0.5">×{li.orderQty}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-green-700 font-semibold uppercase tracking-wider whitespace-nowrap">
                                            New ETA:
                                        </span>
                                        <input
                                            type="date"
                                            value={backorderedETA}
                                            onChange={(e) => setBackorderedETA(e.target.value)}
                                            className="text-xs border border-green-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                                        />
                                        <span className="text-[10px] text-gray-400 italic">optional</span>
                                    </div>
                                </div>
                            )}

                            {/* Credit blocked / substituted: free-text notes */}
                            {(portalOutcome === 'credit_blocked' || portalOutcome === 'substituted') && (
                                <textarea
                                    rows={2}
                                    placeholder={
                                        portalOutcome === 'credit_blocked'
                                            ? 'Details / next steps?'
                                            : 'What was substituted? Details?'
                                    }
                                    value={portalNotes}
                                    onChange={(e) => setPortalNotes(e.target.value)}
                                    className="w-full text-xs border border-green-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-400 placeholder-slate-300 resize-none"
                                />
                            )}
                            <input
                                type="text"
                                placeholder="Supplier's portal order / confirmation number (optional)"
                                value={portalOrderRefInput}
                                onChange={(e) => setPortalOrderRefInput(e.target.value)}
                                className="w-full text-xs border border-green-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-400 placeholder-slate-300"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        let compiledNotes = portalNotes
                                        if (portalOutcome === 'backordered') {
                                            const selected = displayItems.filter((li) =>
                                                backorderedItemIds.has(`${li.inventoryId}|${li.size ?? ''}`)
                                            )
                                            const itemsText = selected.length > 0
                                                ? selected.map((li) => {
                                                    const sizePart = li.size ? ` [${li.size}]` : ''
                                                    return `${li.name}${sizePart} (${li.articleNumber}) ×${li.orderQty}`
                                                }).join(', ')
                                                : 'Items not specified'
                                            const etaText = backorderedETA ? `. New ETA: ${backorderedETA}` : ''
                                            compiledNotes = `Backordered: ${itemsText}${etaText}`
                                        }
                                        onMarkOrdered?.(po.id, portalOrderRefInput, portalOutcome, compiledNotes)
                                        setMarkOrderedOpen(false)
                                        setPortalOrderRefInput('')
                                        setPortalOutcome('confirmed')
                                        setPortalNotes('')
                                        setBackorderedItemIds(new Set())
                                        setBackorderedETA('')
                                    }}
                                    className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg transition-colors"
                                >
                                    ✓ Confirm Order Placed
                                </button>
                                <button
                                    onClick={() => {
                                        setMarkOrderedOpen(false)
                                        setPortalOrderRefInput('')
                                        setPortalOutcome('confirmed')
                                        setPortalNotes('')
                                        setBackorderedItemIds(new Set())
                                        setBackorderedETA('')
                                    }}
                                    className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Approval panel — shown when PO is pending_approval ── */}
                    {po.approvalStatus === 'pending_approval' && (
                        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
                            <p className="text-xs font-semibold text-amber-800">
                                🔐 This PO requires approval before sending — total{' '}
                                <span className="font-bold">{formatCurrency(grandTotal)}</span>
                            </p>
                            {rejectMode ? (
                                <div className="space-y-2">
                                    <textarea
                                        rows={2}
                                        placeholder="Reason for rejection..."
                                        value={rejectNote}
                                        onChange={(e) => setRejectNote(e.target.value)}
                                        className="w-full text-xs border border-red-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-red-400 placeholder-slate-300 resize-none"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { onReject?.(po.id, rejectNote); setRejectMode(false); setRejectNote('') }}
                                            className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg transition-colors"
                                        >
                                            ✗ Confirm Reject
                                        </button>
                                        <button
                                            onClick={() => { setRejectMode(false); setRejectNote('') }}
                                            className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onApprove?.(po.id)}
                                        className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg transition-colors"
                                    >
                                        ✓ Approve PO
                                    </button>
                                    <button
                                        onClick={() => setRejectMode(true)}
                                        className="text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        ✗ Reject
                                    </button>
                                </div>
                            )}
                            {po.approvalNote && (
                                <p className="text-xs text-red-700 italic border-t border-amber-200 pt-2">
                                    Rejection note: {po.approvalNote}
                                </p>
                            )}
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

                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                    {isSent ? (
                                        <span className="text-xs font-semibold text-purple-600 flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                                            🔒 {po.status} — view only
                                        </span>
                                    ) : (
                                        <>
                                            {/* Show "Mark as Ordered" only for Draft/Reviewed POs not yet placed */}
                                            {onMarkOrdered && !po.placedAt && (
                                                <button
                                                    onClick={() => setMarkOrderedOpen((v) => !v)}
                                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                                                        markOrderedOpen
                                                            ? 'bg-gray-100 text-gray-700'
                                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                                    }`}
                                                >
                                                    ✓ Placed on Portal
                                                </button>
                                            )}
                                            <button
                                                onClick={downloadPDF}
                                                disabled={downloading || displayItems.length === 0}
                                                className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 disabled:opacity-60 text-gray-700 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                {downloading ? (
                                                    <>
                                                        <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                                                        Downloading…
                                                    </>
                                                ) : (
                                                    '⬇ Download PDF'
                                                )}
                                            </button>
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
