/**
 * Generates text-based test delivery note PDFs from real supplier data.
 * Run: npx ts-node --skip-project scripts/generate-test-delivery-note.ts
 * Output: public/test-dn-vartex.pdf, public/test-dn-duell.pdf, public/test-dn-shoei.pdf
 */

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'

function line(doc: jsPDF, y: number, x1: number, x2: number) {
    doc.line(x1, y, x2, y)
}

// ── 1. VARTEX AB ──────────────────────────────────────────────────────────────
function generateVartex() {
    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(18).setFont('helvetica', 'bold')
    doc.text('FÖLJESEDEL', 105, y, { align: 'center' })
    y += 12

    doc.setFontSize(9).setFont('helvetica', 'normal')
    doc.text('Vartex AB | Batterivägen 14 | 432 32 Varberg | Sweden | Respons@vartex.se', 105, y, { align: 'center' })
    y += 10

    line(doc, y, 14, 196); y += 6

    doc.setFont('helvetica', 'bold').text('Ordernummer:', 14, y)
    doc.setFont('helvetica', 'normal').text('002E39206', 55, y)
    doc.setFont('helvetica', 'bold').text('Följesedelsdatum:', 105, y)
    doc.setFont('helvetica', 'normal').text('2026-03-04', 150, y)
    y += 6

    doc.setFont('helvetica', 'bold').text('Kundnummer:', 14, y)
    doc.setFont('helvetica', 'normal').text('3238600', 55, y)
    doc.setFont('helvetica', 'bold').text('Leveransdatum:', 105, y)
    doc.setFont('helvetica', 'normal').text('2026-03-03', 150, y)
    y += 6

    doc.setFont('helvetica', 'bold').text('Er referens:', 14, y)
    doc.setFont('helvetica', 'normal').text('79603', 55, y)
    y += 8

    doc.setFont('helvetica', 'bold').text('Leveransadress:', 14, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.text('AVA MC AB', 14, y); y += 5
    doc.text('MÖRTNÄS HAGVÄG 13', 14, y); y += 5
    doc.text('134 44 GUSTAVSBERG', 14, y); y += 10

    line(doc, y, 14, 196); y += 6

    // Table header
    doc.setFont('helvetica', 'bold').setFontSize(9)
    doc.text('Art nr', 14, y)
    doc.text('Benämning', 50, y)
    doc.text('Storlek', 130, y)
    doc.text('Färg', 155, y)
    doc.text('Beställt', 168, y)
    doc.text('Lev ant', 183, y)
    y += 3
    line(doc, y, 14, 196); y += 5

    doc.setFont('helvetica', 'normal')
    const items = [
        ['501190Z005-A5', 'SKYDDSTRÖJA KNOX URBANE PRO MK3 HE', 'M', 'SVART', '1', '1'],
        ['501190Z005-A6', 'SKYDDSTRÖJA KNOX URBANE PRO MK3 HE', 'L', 'SVART', '1', '1'],
    ]
    for (const [art, name, size, color, ordered, delivered] of items) {
        doc.text(art, 14, y)
        doc.text(name, 50, y)
        doc.text(size, 130, y)
        doc.text(color, 155, y)
        doc.text(ordered, 171, y)
        doc.text(delivered, 186, y)
        y += 7
    }

    line(doc, y, 14, 196); y += 8
    doc.setFont('helvetica', 'italic').text('Tack för er beställning! / Thank you for your order.', 14, y)

    const out = path.join(process.cwd(), 'public', 'test-dn-vartex.pdf')
    fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')))
    console.log('✅ Vartex:', out)
}

// ── 2. DUELL AB ───────────────────────────────────────────────────────────────
function generateDuell() {
    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(18).setFont('helvetica', 'bold')
    doc.text('FÖLJESEDEL 5008633', 105, y, { align: 'center' })
    y += 12

    doc.setFontSize(9).setFont('helvetica', 'normal')
    doc.text('Duell AB | Bredkransvägen 10 | 573 92 Tranås | Sweden | info@duell.eu', 105, y, { align: 'center' })
    y += 10

    line(doc, y, 14, 196); y += 6

    doc.setFont('helvetica', 'bold').text('Ordernummer:', 14, y)
    doc.setFont('helvetica', 'normal').text('5008633', 55, y)
    doc.setFont('helvetica', 'bold').text('Orderdatum:', 105, y)
    doc.setFont('helvetica', 'normal').text('3.9.2025', 145, y)
    y += 6

    doc.setFont('helvetica', 'bold').text('Kundnummer:', 14, y)
    doc.setFont('helvetica', 'normal').text('4804', 55, y)
    doc.setFont('helvetica', 'bold').text('Er referens:', 105, y)
    doc.setFont('helvetica', 'normal').text('79362', 145, y)
    y += 6

    doc.setFont('helvetica', 'bold').text('Lev.villkor:', 14, y)
    doc.setFont('helvetica', 'normal').text('DAP | PostNord Parcel Norden', 55, y)
    y += 8

    doc.setFont('helvetica', 'bold').text('Leveransadress:', 14, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.text('AB AVA MC', 14, y); y += 5
    doc.text('MÖRTNÄS HAGVÄG 13', 14, y); y += 5
    doc.text('13444 GUSTAVSBERG | SVERIGE', 14, y); y += 10

    line(doc, y, 14, 196); y += 6

    doc.setFont('helvetica', 'bold').setFontSize(9)
    doc.text('Art nr', 14, y)
    doc.text('Artikel', 55, y)
    doc.text('Lev antal', 148, y)
    doc.text('Restorder', 165, y)
    doc.text('Brutto', 183, y)
    y += 3
    line(doc, y, 14, 196); y += 5

    doc.setFont('helvetica', 'normal')
    const items = [
        ['692-3226221-10-6', 'Alpinestars Byxa AST-1 v2 Kort Drystar Svart 3XL', '1', '0', '2795.00'],
        ['694-3518321-12-0', 'Alpinestars Handske Dam SP-8 v3 Svart/Vit XS',    '1', '0', '1499.00'],
        ['694-3518321-12-1', 'Alpinestars Handske Dam SP-8 v3 Svart/Vit S',     '2', '0', '1499.00'],
        ['694-3518321-12-2', 'Alpinestars Handske Dam SP-8 v3 Svart/Vit M',     '2', '0', '1499.00'],
        ['694-3570518-10-2', 'Alpinestars Handske SMX-1 Air v2 Svart M',        '1', '0', '1150.00'],
        ['694-3570518-10-5', 'Alpinestars Handske SMX-1 Air v2 Svart 2XL',      '2', '0', '1150.00'],
    ]
    for (const [art, name, lev, rest, brutto] of items) {
        doc.text(art, 14, y)
        doc.text(name, 55, y)
        doc.text(lev,    152, y)
        doc.text(rest,   169, y)
        doc.text(brutto, 183, y)
        y += 7
    }

    line(doc, y, 14, 196)

    const out = path.join(process.cwd(), 'public', 'test-dn-duell.pdf')
    fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')))
    console.log('✅ Duell:', out)
}

// ── 3. SHOEI ──────────────────────────────────────────────────────────────────
function generateShoei() {
    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(18).setFont('helvetica', 'bold')
    doc.text('Delivery note', 196, y, { align: 'right' })
    y += 10

    doc.setFontSize(9).setFont('helvetica', 'normal')
    doc.text('Shoei Distribution GmbH | Elisabeth-Selbert-Strasse 13 | 40764 Langenfeld | Germany', 14, y)
    y += 10

    doc.setFont('helvetica', 'bold').text('Delivery note No.:', 105, y)
    doc.setFont('helvetica', 'normal').text('368298', 160, y)
    y += 5
    doc.setFont('helvetica', 'bold').text('Delivery date:', 105, y)
    doc.setFont('helvetica', 'normal').text('16.02.2026', 160, y)
    y += 5
    doc.setFont('helvetica', 'bold').text('Delivery debtor No.:', 105, y)
    doc.setFont('helvetica', 'normal').text('2900016', 160, y)
    y += 5
    doc.setFont('helvetica', 'bold').text('Order No.:', 105, y)
    doc.setFont('helvetica', 'normal').text('1231774', 160, y)
    y += 5
    doc.setFont('helvetica', 'bold').text('Order date:', 105, y)
    doc.setFont('helvetica', 'normal').text('16.02.2026', 160, y)
    y += 10

    doc.setFont('helvetica', 'bold').text('Ship to:', 14, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.text('AVA MC AB', 14, y); y += 5
    doc.text('Mörtnäs Hagväg 13', 14, y); y += 5
    doc.text('13444 Gustavsberg | Sweden', 14, y); y += 10

    line(doc, y, 14, 196); y += 6

    doc.setFont('helvetica', 'bold').setFontSize(9)
    doc.text('Quantity', 14, y)
    doc.text('Item code', 35, y)
    doc.text('Item description', 70, y)
    doc.text('EAN', 148, y)
    doc.text('Delivery date', 175, y)
    y += 3
    line(doc, y, 14, 196); y += 5

    doc.setFont('helvetica', 'normal')
    const items = [
        ['1', '11 20 011 6', 'GT-AIR3 Matt Black [XL]',       '4512048819385', '16.02.2026'],
        ['2', '21 01 004 0', 'SENA SRL3 (NEO3/GTA3/JCR3)',    '8809917360458', '16.02.2026'],
    ]
    for (const [qty, code, desc, ean, date] of items) {
        doc.text(qty, 18, y)
        doc.text(code, 35, y)
        doc.text(desc, 70, y)
        doc.text(ean, 148, y)
        doc.text(date, 175, y)
        y += 7
    }

    line(doc, y, 14, 196); y += 6
    doc.setFontSize(8).setFont('helvetica', 'italic')
    doc.text('3: Total quantity', 14, y)

    const out = path.join(process.cwd(), 'public', 'test-dn-shoei.pdf')
    fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')))
    console.log('✅ Shoei:', out)
}

// ── Run all ───────────────────────────────────────────────────────────────────
generateVartex()
generateDuell()
generateShoei()
console.log('\nAll test delivery note PDFs generated in /public/')
