// Run: node generate-test-dn-mal-backorder.js
// Generates test-dn-mal-backorder.pdf — PO-MAL-2026-001 with 1 item delivered, 1 backordered.

const { jsPDF } = require('jspdf')
const fs = require('fs')

const doc = new jsPDF({ unit: 'mm', format: 'a4' })

const L = 15
const R = 195
const mid = 105

// ── Header ────────────────────────────────────────────────────────────────────
doc.setFont('helvetica', 'bold')
doc.setFontSize(20)
doc.text('FÖLJESEDEL', mid, 22, { align: 'center' })

doc.setFont('helvetica', 'normal')
doc.setFontSize(9)
doc.text('Vartex AB | Batterivägen 14 | 432 32 Varberg | Sweden | Respons@vartex.se', mid, 30, { align: 'center' })

doc.setLineWidth(0.3)
doc.line(L, 35, R, 35)

// ── Meta fields ───────────────────────────────────────────────────────────────
const col1L = L, col1V = 58, col2L = 110, col2V = 155

function field(label, value, x, xv, y) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text(label + ':', x, y)
  doc.setFont('helvetica', 'normal')
  doc.text(value, xv, y)
}

field('Ordernummer',      '002E39207',       col1L, col1V, 44)
field('Följesedelsdatum', '2026-03-05',       col2L, col2V, 44)
field('Kundnummer',       '3238600',          col1L, col1V, 52)
field('Leveransdatum',    '2026-03-04',       col2L, col2V, 52)
field('Er referens',      'PO-SPE-2026-001',  col1L, col1V, 60)

// ── Delivery address ──────────────────────────────────────────────────────────
doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
doc.text('Leveransadress:', L, 72)
doc.setFont('helvetica', 'normal')
doc.text('AVA MC AB',           L, 79)
doc.text('MÖRTNÄS HAGVÄG 13',   L, 85)
doc.text('134 44 GUSTAVSBERG',  L, 91)

doc.line(L, 98, R, 98)

// ── Table header ──────────────────────────────────────────────────────────────
doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
doc.text('Art nr',     L,   107)
doc.text('Benämning',  58,  107)
doc.text('Storlek',    133, 107)
doc.text('Färg',       152, 107)
doc.text('Beställt',   166, 107)
doc.text('Lev ant',    183, 107)
doc.line(L, 110, R, 110)

// ── Item 1 — delivered 1 of 2 (1 backordered) ────────────────────────────────
doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
doc.text('501190Z005-A5',                       L,   119)
doc.text('SKYDDSTRÖJA KNOX URBANE PRO MK3 HE',  58,  119)
doc.text('M',                                   135, 119)
doc.text('SVART',                               152, 119)
doc.text('2',                                   170, 119)
doc.text('1',                                   187, 119)

doc.line(L, 124, R, 124)

// ── Footer ────────────────────────────────────────────────────────────────────
doc.setFont('helvetica', 'italic'); doc.setFontSize(9)
doc.text('Tack för er beställning! / Thank you for your order.', L, 133)
doc.text('OBS: Restorder 1 st artikel 501190Z005-A5 levereras vid nästa tillfälle.', L, 140)

// ── Write file ────────────────────────────────────────────────────────────────
const outPath = 'test-dn-mal-backorder.pdf'
const pdfBytes = Buffer.from(doc.output('arraybuffer'))
fs.writeFileSync(outPath, pdfBytes)
console.log('✓ Generated:', outPath, `(${(pdfBytes.length / 1024).toFixed(1)} KB)`)
