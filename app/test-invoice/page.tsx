'use client'

import { useEffect, useState } from 'react'

const INVOICE = {
    invoiceNumber:  'INV-VAR-2026-002E39210',
    orderNumber:    '002E39210',
    poNumber:       'PO-LAK-2026-001',
    invoiceDate:    '2026-03-10',
    dueDate:        '2026-04-09',
    vendor: {
        name:    'Vartex AB',
        address: 'Batterivägen 14, 432 32 Varberg, Sweden',
        email:   'Respons@vartex.se',
        phone:   '',
        org:     'Kundnummer: 3238600',
    },
    billTo: {
        name:    'AVA MC AB',
        address: 'Mörtnäs Hagväg 13, 134 44 Gustavsberg, Sweden',
        email:   'invoice@bikeme.now',
    },
    items: [
        {
            articleNumber: '501190Z005-A5',
            description:   'Skyddströja Knox Urbane Pro MK3 HE — Storlek M, Svart',
            qty:           1,
            unitCost:      1595,
        },
        {
            articleNumber: '501190Z005-A6',
            description:   'Skyddströja Knox Urbane Pro MK3 HE — Storlek L, Svart',
            qty:           1,
            unitCost:      1595,
        },
    ],
    notes: 'Er referens: PO-LAK-2026-001 · Ordernummer: 002E39210 · Betalningsvillkor: 30 dagar netto.',
}

export default function TestInvoicePage() {
    const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle')

    async function generatePDF() {
        setStatus('generating')
        try {
            const { default: jsPDF }     = await import('jspdf')
            const { default: autoTable } = await import('jspdf-autotable')

            const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            const pageW  = doc.internal.pageSize.getWidth()
            const margin = 14
            const navy   = [30, 58, 95]   as [number, number, number]
            const green  = [22, 163, 74]  as [number, number, number]

            // ── Header ────────────────────────────────────────────────────────
            doc.setFillColor(...navy)
            doc.rect(0, 0, pageW, 38, 'F')
            doc.setTextColor(147, 197, 253)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.text(INVOICE.vendor.name.toUpperCase(), margin, 10)
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(20)
            doc.text('PURCHASE INVOICE', margin, 22)
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(147, 197, 253)
            doc.text(INVOICE.invoiceNumber, pageW - margin, 22, { align: 'right' })
            doc.setDrawColor(...green)
            doc.setLineWidth(0.8)
            doc.line(0, 38, pageW, 38)

            // ── Dates ─────────────────────────────────────────────────────────
            doc.setTextColor(80, 80, 80)
            doc.setFontSize(8.5)
            doc.setFont('helvetica', 'normal')
            doc.text(`Fakturadatum: ${INVOICE.invoiceDate}`, margin, 46)
            doc.text(`Förfallodatum: ${INVOICE.dueDate}`, margin + 65, 46)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...navy)
            doc.text(`Er referens: ${INVOICE.poNumber}`, pageW - margin, 46, { align: 'right' })
            doc.setDrawColor(220, 220, 220)
            doc.setLineWidth(0.3)
            doc.line(margin, 50, pageW - margin, 50)

            // ── Vendor / Bill To ──────────────────────────────────────────────
            const colMid = pageW / 2 + 4
            let blockY   = 56

            doc.setFontSize(6.5)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...navy)
            doc.text('FROM (SUPPLIER)', margin, blockY)
            doc.setFontSize(9)
            doc.setTextColor(20, 20, 20)
            doc.text(INVOICE.vendor.name, margin, blockY + 5)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(80, 80, 80)
            doc.text(INVOICE.vendor.address, margin, blockY + 10)
            doc.text(INVOICE.vendor.email,   margin, blockY + 15)
            doc.text(INVOICE.vendor.phone,   margin, blockY + 19.5)
            doc.text(INVOICE.vendor.org,     margin, blockY + 24)

            doc.setFontSize(6.5)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...navy)
            doc.text('BILL TO', colMid, blockY)
            doc.setFontSize(9)
            doc.setTextColor(20, 20, 20)
            doc.text(INVOICE.billTo.name, colMid, blockY + 5)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(80, 80, 80)
            doc.text(INVOICE.billTo.address, colMid, blockY + 10)
            doc.text(INVOICE.billTo.email,   colMid, blockY + 15)

            blockY += 32
            doc.setDrawColor(220, 220, 220)
            doc.setLineWidth(0.3)
            doc.line(margin, blockY, pageW - margin, blockY)

            // ── Line items table ──────────────────────────────────────────────
            const rows = INVOICE.items.map(item => [
                item.articleNumber,
                item.description,
                String(item.qty),
                `SEK ${item.unitCost.toLocaleString('sv-SE')}`,
                `SEK ${(item.qty * item.unitCost).toLocaleString('sv-SE')}`,
            ])

            const subtotal = INVOICE.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
            const vat      = subtotal * 0.25
            const total    = subtotal + vat

            const fmt = (n: number) => `SEK ${n.toLocaleString('sv-SE')}`

            autoTable(doc, {
                startY: blockY + 3,
                head: [['Article No.', 'Description', 'Qty', 'Unit Cost', 'Line Total']],
                body: rows,
                foot: [
                    ['', '', '', 'Subtotal', fmt(subtotal)],
                    ['', '', '', 'VAT (25%)', fmt(vat)],
                    ['', '', '', 'TOTAL DUE', fmt(total)],
                ],
                styles:             { fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 } },
                headStyles:         { fillColor: navy, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
                bodyStyles:         { textColor: [40, 40, 40] },
                alternateRowStyles: { fillColor: [246, 248, 252] },
                footStyles:         { fillColor: [240, 244, 250], textColor: navy, fontStyle: 'bold', fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 30, textColor: [100, 100, 100] },
                    2: { halign: 'center', cellWidth: 16 },
                    3: { halign: 'right',  cellWidth: 34 },
                    4: { halign: 'right',  cellWidth: 34 },
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
            const curY = (doc as DocWithTable).lastAutoTable.finalY + 8

            // ── Notes ─────────────────────────────────────────────────────────
            doc.setFillColor(255, 251, 235)
            doc.setDrawColor(253, 230, 138)
            doc.roundedRect(margin, curY, pageW - margin * 2, 12, 1.5, 1.5, 'FD')
            doc.setFontSize(7.5)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(120, 80, 0)
            doc.text('Notes:', margin + 3, curY + 5)
            doc.setFont('helvetica', 'normal')
            doc.text(INVOICE.notes, margin + 16, curY + 5)

            // ── Footer ────────────────────────────────────────────────────────
            doc.setFillColor(...navy)
            doc.rect(0, 277, pageW, 20, 'F')
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(147, 197, 253)
            doc.text(`Faktura ${INVOICE.invoiceNumber}  ·  ${INVOICE.vendor.name}  ·  Förfallodatum ${INVOICE.dueDate}`, pageW / 2, 288, { align: 'center' })

            doc.save(`${INVOICE.invoiceNumber}.pdf`)
            setStatus('done')
        } catch (err) {
            console.error(err)
            setStatus('idle')
        }
    }

    useEffect(() => { generatePDF() }, [])

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
            <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 10, padding: '32px 24px' }}>
                <p style={{ color: '#93c5fd', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 8px' }}>Test Invoice</p>
                <h2 style={{ margin: '0 0 4px', fontFamily: 'monospace' }}>{INVOICE.invoiceNumber}</h2>
                <p style={{ color: '#93c5fd', margin: '0 0 24px', fontSize: 13 }}>Vartex AB · PO-LAK-2026-001 · 2 items · Due {INVOICE.dueDate}</p>
                {status === 'generating' && <p style={{ color: '#fbbf24' }}>Generating PDF...</p>}
                {status === 'done'       && <p style={{ color: '#86efac' }}>✓ PDF downloaded</p>}
                <button
                    onClick={generatePDF}
                    style={{ marginTop: 16, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', cursor: 'pointer', fontSize: 14 }}
                >
                    Download Again
                </button>
            </div>
            <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 16 }}>
                Send <strong>{INVOICE.invoiceNumber}.pdf</strong> to <strong>invoice@bikeme.now</strong> to test inbound processing.
            </p>
        </div>
    )
}
