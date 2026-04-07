// Run: node generate-system-doc.js
// Generates: bikeme-system-documentation.pdf

const { jsPDF } = require('jspdf')
const fs = require('fs')

const doc = new jsPDF({ unit: 'mm', format: 'a4' })
const PW = 210  // page width
const PH = 297  // page height
const ML = 18   // margin left
const MR = 192  // margin right
const TW = MR - ML // text width
let y = 0
let pageNum = 1

// ── Color helpers ──────────────────────────────────────────────────────────
const C = {
    black:      [30, 30, 30],
    heading:    [15, 60, 120],
    sub:        [30, 100, 160],
    accent:     [220, 90, 30],
    muted:      [120, 120, 120],
    white:      [255, 255, 255],
    lightblue:  [235, 245, 255],
    lightgrey:  [248, 248, 248],
    border:     [200, 210, 220],
    green:      [30, 140, 80],
    orange:     [200, 100, 20],
    red:        [180, 40, 40],
}

function setColor(rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]) }
function setFill(rgb)  { doc.setFillColor(rgb[0], rgb[1], rgb[2]) }
function setDraw(rgb)  { doc.setDrawColor(rgb[0], rgb[1], rgb[2]) }

// ── Page management ────────────────────────────────────────────────────────
function newPage() {
    doc.addPage()
    pageNum++
    y = 20
    // footer
    setColor(C.muted)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('bikeme.now — System Documentation', ML, PH - 8)
    doc.text(`Page ${pageNum}`, MR, PH - 8, { align: 'right' })
    setColor(C.black)
}

function checkY(needed = 20) {
    if (y + needed > PH - 18) newPage()
}

// ── Typography helpers ─────────────────────────────────────────────────────
function h1(text) {
    checkY(18)
    setFill(C.heading)
    doc.setDrawColor(0,0,0)
    doc.rect(ML, y - 5, TW, 12, 'F')
    setColor(C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(text, ML + 4, y + 3)
    setColor(C.black)
    y += 14
}

function h2(text) {
    checkY(14)
    y += 3
    setColor(C.sub)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(text, ML, y)
    setColor(C.black)
    setDraw(C.sub)
    doc.setLineWidth(0.4)
    doc.line(ML, y + 1.5, ML + doc.getTextWidth(text) + 2, y + 1.5)
    setDraw([0,0,0])
    y += 8
}

function h3(text) {
    checkY(10)
    y += 2
    setColor(C.accent)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('▶  ' + text, ML, y)
    setColor(C.black)
    y += 7
}

function body(text, indent = 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    setColor(C.black)
    const lines = doc.splitTextToSize(text, TW - indent)
    checkY(lines.length * 5.5 + 2)
    doc.text(lines, ML + indent, y)
    y += lines.length * 5.5 + 1
}

function bullet(text, indent = 4) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    setColor(C.black)
    const lines = doc.splitTextToSize(text, TW - indent - 5)
    checkY(lines.length * 5.5 + 1)
    setColor(C.accent)
    doc.text('•', ML + indent, y)
    setColor(C.black)
    doc.text(lines, ML + indent + 5, y)
    y += lines.length * 5.5 + 1
}

function note(text) {
    const lines = doc.splitTextToSize(text, TW - 8)
    checkY(lines.length * 5 + 6)
    setFill(C.lightblue)
    setDraw(C.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(ML, y - 3, TW, lines.length * 5 + 5, 2, 2, 'FD')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    setColor(C.sub)
    doc.text(lines, ML + 4, y + 1.5)
    setColor(C.black)
    y += lines.length * 5 + 7
}

function warn(text) {
    const lines = doc.splitTextToSize(text, TW - 8)
    checkY(lines.length * 5 + 6)
    setFill([255, 248, 235])
    setDraw([200, 150, 50])
    doc.setLineWidth(0.3)
    doc.roundedRect(ML, y - 3, TW, lines.length * 5 + 5, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setColor(C.orange)
    doc.text('⚠  ' + text, ML + 4, y + 1.5)
    setColor(C.black)
    y += lines.length * 5 + 7
}

function space(n = 4) { y += n }

function divider() {
    checkY(6)
    setDraw(C.border)
    doc.setLineWidth(0.2)
    doc.line(ML, y, MR, y)
    setDraw([0,0,0])
    y += 5
}

// ── Box / diagram helpers ──────────────────────────────────────────────────
function box(text, x, bw, by, bh, fillC, textC) {
    setFill(fillC)
    setDraw(C.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, by, bw, bh, 2, 2, 'FD')
    setColor(textC || C.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const lines = doc.splitTextToSize(text, bw - 4)
    doc.text(lines, x + bw / 2, by + bh / 2 + (lines.length === 1 ? 1.5 : -0.5), { align: 'center' })
    setColor(C.black)
}

function arrow(x1, y1, x2, y2) {
    setDraw(C.muted)
    doc.setLineWidth(0.4)
    doc.line(x1, y1, x2, y2)
    // arrowhead (simple)
    const ang = Math.atan2(y2 - y1, x2 - x1)
    const as = 2.5
    doc.line(x2, y2, x2 - as * Math.cos(ang - 0.4), y2 - as * Math.sin(ang - 0.4))
    doc.line(x2, y2, x2 - as * Math.cos(ang + 0.4), y2 - as * Math.sin(ang + 0.4))
    setDraw([0,0,0])
}

function tableRow(cols, widths, rowY, header = false) {
    const rowH = 7
    let x = ML
    setFill(header ? C.heading : (rowY % 14 < 7 ? C.lightgrey : C.white))
    setDraw(C.border)
    doc.setLineWidth(0.2)
    widths.forEach((w, i) => {
        doc.rect(x, rowY, w, rowH, header ? 'FD' : 'D')
        setColor(header ? C.white : C.black)
        doc.setFont('helvetica', header ? 'bold' : 'normal')
        doc.setFontSize(8.5)
        doc.text(cols[i] ?? '', x + 2, rowY + 4.8)
        x += w
    })
    setColor(C.black)
    return rowH
}

// ══════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ══════════════════════════════════════════════════════════════════════════
y = 0
setFill(C.heading)
doc.rect(0, 0, PW, 90, 'F')

setColor(C.white)
doc.setFont('helvetica', 'bold')
doc.setFontSize(28)
doc.text('bikeme.now', PW / 2, 45, { align: 'center' })
doc.setFontSize(14)
doc.setFont('helvetica', 'normal')
doc.text('System Documentation', PW / 2, 57, { align: 'center' })
doc.setFontSize(9)
setColor([180, 210, 255])
doc.text('Purchase Orders  •  Inventory  •  Delivery Notes  •  Email Routing', PW / 2, 67, { align: 'center' })

setColor(C.black)
y = 105

doc.setFont('helvetica', 'bold')
doc.setFontSize(11)
setColor(C.heading)
doc.text('What is bikeme.now?', ML, y); y += 8

doc.setFont('helvetica', 'normal')
doc.setFontSize(9.5)
setColor(C.black)
const intro = 'bikeme.now is a multi-dealer motorcycle dealership management platform. It handles everything from ordering parts and motorcycles from suppliers, tracking inventory in real time, automatically receiving and processing supplier delivery notes via email, and updating stock — all without manual data entry.'
const introLines = doc.splitTextToSize(intro, TW)
doc.text(introLines, ML, y); y += introLines.length * 5.5 + 6

doc.setFont('helvetica', 'bold')
doc.setFontSize(11)
setColor(C.heading)
doc.text('Dealers covered in this document', ML, y); y += 8

setColor(C.black)
doc.setFont('helvetica', 'normal')
doc.setFontSize(9.5)
doc.text('• AVA MC  — an example dealer registered on the bikeme.now platform', ML + 4, y); y += 7
doc.text('• Each dealer is completely separated from others using a unique Dealership ID.', ML + 4, y); y += 10

// Dealership isolation diagram
setFill(C.lightblue)
setDraw(C.border)
doc.setLineWidth(0.3)
doc.roundedRect(ML, y, TW, 50, 3, 3, 'FD')

const bw = 48, bh = 16, gap = 9
const bx1 = ML + gap, bx2 = ML + gap + bw + 6, bx3 = ML + gap + (bw + 6) * 2
const by1 = y + 8
box('AVA MC\nDealership ID: abc-001', bx1, bw, by1, bh, [200, 225, 255], C.heading)
box('Dealer B\nDealership ID: abc-002', bx2, bw, by1, bh, [200, 225, 255], C.heading)
box('Dealer C\nDealership ID: abc-003', bx3, bw, by1, bh, [200, 225, 255], C.heading)

const mid = y + 8 + bh + 3
setDraw(C.muted)
doc.setLineWidth(0.3)
doc.line(ML + TW/2, mid, ML + TW/2, mid + 8)
setFill(C.heading)
doc.roundedRect(ML + TW/2 - 35, mid + 8, 70, 10, 2, 2, 'F')
setColor(C.white)
doc.setFont('helvetica', 'bold')
doc.setFontSize(8)
doc.text('bikeme.now Platform (Supabase)', ML + TW/2, mid + 14.5, { align: 'center' })
setColor(C.black)

doc.setFont('helvetica', 'italic')
doc.setFontSize(8)
setColor(C.muted)
doc.text('Each dealer sees ONLY their own data. No crossover.', ML + TW/2, y + 47, { align: 'center' })

y += 58

setColor(C.black)
doc.setFont('helvetica', 'normal')
doc.setFontSize(9)
setColor(C.muted)
doc.text(`Generated: ${new Date().toDateString()}`, ML, PH - 15)
doc.text('CONFIDENTIAL — Internal Use Only', MR, PH - 15, { align: 'right' })

// footer p1
setColor(C.muted)
doc.setFontSize(8)
doc.text('bikeme.now — System Documentation', ML, PH - 8)
doc.text('Page 1', MR, PH - 8, { align: 'right' })

// ══════════════════════════════════════════════════════════════════════════
// PAGE 2 — MULTI-TENANT SYSTEM
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('1.  Multi-Tenant Architecture — How Dealers Are Separated')
body('bikeme.now is a shared platform where multiple motorcycle dealerships operate independently. Each dealership is assigned a unique Dealership ID (a UUID — a long random identifier like "3f8a-b21c-...") when they register. Every piece of data in the system — inventory, purchase orders, goods receipts, staff accounts — is tagged with this ID.')
space()
body('This means:')
bullet('AVA MC can never see Dealer B\'s inventory, orders, or receipts.')
bullet('Staff log in under their dealership account and only see their own data.')
bullet('Emails, notifications, and stock updates are all scoped to one dealership.')
space()
note('Think of it like separate apartments in the same building. The building (bikeme.now) is shared, but each apartment (dealer) has its own locked door.')
space()

h2('How the Dealership ID is used')
body('Every database table has a dealership_id column. When any staff member performs any action:')
bullet('Create a PO → stored with dealership_id')
bullet('Receive a delivery note → linked to dealership_id')
bullet('Update stock → scoped to dealership_id')
bullet('View reports → filtered by dealership_id')
space()
warn('If the Dealership ID cannot be determined (for example, an email arrives with no PO reference and no known vendor), the system cannot process it. The email is logged and flagged for manual review.')

space(6)
h2('Staff & Roles')
body('Each dealer has their own staff accounts. Roles control what each person can do:')

const rw = [40, 130]
let ry = y
tableRow(['Role', 'What they can do'], rw, ry, true); ry += 7
tableRow(['Admin', 'Full access — approve receipts, manage settings, view all reports'], rw, ry); ry += 7
tableRow(['Manager', 'Create POs, view inventory, manage vendors'], rw, ry); ry += 7
tableRow(['Staff', 'View inventory, receive deliveries, create basic orders'], rw, ry); ry += 7
y = ry + 4

// ══════════════════════════════════════════════════════════════════════════
// PAGE — INVENTORY
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('2.  Inventory Management')
body('Inventory is split into three separate categories. Each has its own table in the database and its own ID format. This keeps motorcycles, parts, and accessories clearly separated.')
space(4)

h2('2.1  Motorcycles')
body('Motorcycles are high-value items with unique identification via VIN numbers.')
space(2)

const mw = [45, 125]
let mr2 = y
tableRow(['Field', 'Description'], mw, mr2, true); mr2 += 7
const mrows = [
    ['Item ID', 'Format: MC-0001, MC-0002 ... auto-incremented per dealer'],
    ['Name', 'Full model name e.g. Honda CB500F 2024'],
    ['Brand', 'Manufacturer e.g. Honda, Yamaha, KTM'],
    ['VIN Number', 'Vehicle Identification Number — unique 17-char code per bike'],
    ['Year', 'Model year'],
    ['Engine CC', 'Engine displacement e.g. 500, 1000'],
    ['Colour', 'Body colour'],
    ['Type', 'Sport / Touring / Off-Road / Scooter etc.'],
    ['Stock', 'Current number of units in stock'],
    ['Reorder Qty', 'Minimum stock level — triggers auto PO when stock falls below'],
    ['Cost', 'Purchase cost from supplier'],
    ['Selling Price', 'Retail price to customer'],
    ['Vendor', 'Supplier name — used to auto-match delivery notes'],
]
mrows.forEach(r => { tableRow(r, mw, mr2); mr2 += 7 })
y = mr2 + 4

h3('VIN Number — What it is and why it matters')
body('VIN stands for Vehicle Identification Number. Every motorcycle manufactured has a unique 17-character VIN stamped on the frame. It is the global standard for identifying individual vehicles.')
space(2)
setFill(C.lightgrey)
setDraw(C.border)
doc.setLineWidth(0.3)
doc.roundedRect(ML, y, TW, 16, 2, 2, 'FD')
doc.setFont('courier', 'bold')
doc.setFontSize(12)
setColor(C.heading)
doc.text('JH2PC3504DM200435', PW / 2, y + 6.5, { align: 'center' })
doc.setFont('helvetica', 'normal')
doc.setFontSize(7.5)
setColor(C.muted)
doc.text('WMI (Maker)    Vehicle Description     Check   Year  Plant   Serial', ML + 6, y + 12)
y += 20

bullet('VIN is recorded when a motorcycle is added to inventory.')
bullet('It prevents duplicate entries — no two bikes with the same VIN.')
bullet('Used during sale/registration for legal and warranty purposes.')
bullet('When a delivery note arrives for a motorcycle, the VIN links the received unit to its stock record.')

newPage()
h2('2.2  Spare Parts')
body('Spare parts cover all mechanical components ordered from suppliers — filters, brake pads, chains, cables, tyres, etc.')
space(2)

const sw = [45, 125]
let sr = y
tableRow(['Field', 'Description'], sw, sr, true); sr += 7
const srows = [
    ['Item ID', 'Format: SP-0001, SP-0002 ... auto-incremented per dealer'],
    ['Name', 'Full part name e.g. Oil Filter Honda CB500 2022+'],
    ['Article Number', 'Supplier\'s own part code — used to match delivery notes'],
    ['Category', 'Filter / Brake / Chain / Tyre / Electrical etc.'],
    ['Stock', 'Current quantity in stock'],
    ['Reorder Qty', 'Minimum stock — triggers auto PO when stock drops below'],
    ['Cost', 'Purchase cost from supplier'],
    ['Selling Price', 'Retail or workshop price'],
    ['Vendor', 'Supplier name'],
]
srows.forEach(r => { tableRow(r, sw, sr); sr += 7 })
y = sr + 6

h2('2.3  Accessories')
body('Accessories cover clothing, helmets, gloves, luggage, protective gear and other non-mechanical items.')
space(2)

const aw = [45, 125]
let ar = y
tableRow(['Field', 'Description'], aw, ar, true); ar += 7
const arows = [
    ['Item ID', 'Format: ACC-0001, ACC-0002 ... auto-incremented per dealer'],
    ['Name', 'Full name e.g. Knox Urbane Pro MK3 Jacket'],
    ['Article Number', 'Supplier\'s code e.g. 501190Z005-A5 — used to match delivery notes'],
    ['Size', 'XS / S / M / L / XL / XXL / One Size'],
    ['Colour', 'Item colour'],
    ['Category', 'Helmet / Jacket / Gloves / Luggage / Electronics etc.'],
    ['Stock', 'Current quantity in stock'],
    ['Reorder Qty', 'Minimum stock — triggers auto PO when stock drops below'],
    ['Cost', 'Purchase cost from supplier'],
    ['Selling Price', 'Retail price'],
    ['Vendor', 'Supplier name'],
]
arows.forEach(r => { tableRow(r, aw, ar); ar += 7 })
y = ar + 6

newPage()
h2('2.4  How Item IDs are Generated — Per Dealer')
body('Each dealer has their own separate numbering sequence. This prevents confusion when two dealers both have "SP-0001" — they are completely different items for different dealerships.')
space(3)

setFill(C.lightblue)
setDraw(C.border)
doc.setLineWidth(0.3)
doc.roundedRect(ML, y, TW, 38, 2, 2, 'FD')
const iby = y + 6

doc.setFont('helvetica', 'bold')
doc.setFontSize(9)
setColor(C.heading)
doc.text('AVA MC (dealership_id: abc-001)', ML + 6, iby)
doc.setFont('courier', 'normal')
doc.setFontSize(8.5)
setColor(C.black)
doc.text('MC-0001  Honda CB500F          SP-0001  Oil Filter Honda    ACC-0001  Knox Jacket M', ML + 6, iby + 7)
doc.text('MC-0002  Yamaha MT-07          SP-0002  Brake Pad Front     ACC-0002  Knox Jacket L', ML + 6, iby + 13)

doc.setFont('helvetica', 'bold')
setColor(C.sub)
doc.text('Dealer B (dealership_id: abc-002)', ML + 6, iby + 21)
doc.setFont('courier', 'normal')
setColor(C.black)
doc.text('MC-0001  KTM Duke 390          SP-0001  KTM Air Filter      ACC-0001  Shoei Helmet', ML + 6, iby + 28)
y += 44

body('The ID format is:')
bullet('MC- prefix → Motorcycle')
bullet('SP- prefix → Spare Part')
bullet('ACC- prefix → Accessory')
bullet('Number → auto-incremented starting from 0001 within each dealership')
space(2)
note('When a delivery note arrives, the article number from the supplier PDF is matched against the article_number field in inventory — not the internal MC/SP/ACC ID. The internal ID is just for the system\'s own use.')

space(6)
h2('2.5  Adding Inventory Manually — Required Details')
body('When a staff member adds a new item to inventory manually (not via a delivery note), the following details are required or strongly recommended:')
space(3)

h3('Motorcycles — Required fields when adding manually')
bullet('Name, Brand, Year, Engine CC, Type, Colour — for identification')
bullet('VIN Number — mandatory, must be unique, 17 characters')
bullet('Cost and Selling Price — for financial tracking')
bullet('Vendor — supplier name, must match exactly what the supplier uses in their emails')
bullet('Reorder Qty — set to 1 for motorcycles (usually order individually)')
bullet('Stock — starting quantity (usually 0 if adding before delivery)')

space(2)
h3('Spare Parts & Accessories — Required fields when adding manually')
bullet('Name — descriptive enough to identify in receipts')
bullet('Article Number — CRITICAL: must match exactly what the supplier prints on delivery notes')
bullet('Vendor — must match supplier name in the system settings')
bullet('Cost and Selling Price')
bullet('Reorder Qty — when stock falls to this level, an auto PO is triggered')
bullet('Stock — starting quantity')
bullet('Size (accessories only) — XS/S/M/L/XL/XXL/One Size')

space(2)
warn('Article Number is the most important field for accessories and spare parts. If it does not match the supplier\'s delivery note exactly (including capitalisation and dashes), the system cannot link received items to stock automatically. They will show as "Unmatched" in the goods receipt.')

// ══════════════════════════════════════════════════════════════════════════
// PAGE — REORDER QTY & AUTO PO
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('3.  Reorder Quantity & Automatic Purchase Orders')

h2('3.1  What is Reorder Quantity?')
body('Reorder Quantity (Reorder Qty) is the minimum stock level you set for each inventory item. When the stock falls to or below this number, the system automatically creates a Draft Purchase Order to replenish the item.')
space(3)

setFill(C.lightblue)
setDraw(C.border)
doc.setLineWidth(0.3)
doc.roundedRect(ML, y, TW, 28, 2, 2, 'FD')
doc.setFont('helvetica', 'normal')
doc.setFontSize(9)
setColor(C.black)
doc.text('Example:', ML + 5, y + 7)
doc.setFont('courier', 'normal')
doc.text('Knox Jacket M  |  Stock: 3  |  Reorder Qty: 5', ML + 5, y + 14)
doc.setFont('helvetica', 'italic')
setColor(C.sub)
doc.text('Stock (3) is below Reorder Qty (5)  →  Auto PO triggered for Knox Jacket M', ML + 5, y + 21)
y += 33

h2('3.2  How Automatic PO Works — Step by Step')
body('The system checks stock levels and generates Draft POs automatically. Here is the exact process:')
space(3)

// auto po flow diagram
const steps = [
    { label: 'Inventory\nMonitored', c: C.lightblue },
    { label: 'Stock < Reorder\nQty detected', c: [255, 240, 220] },
    { label: 'Check: open\nDraft PO same\nvendor?', c: C.lightblue },
    { label: 'Add item\nto existing\nDraft PO', c: [220, 255, 220] },
    { label: 'Create new\nDraft PO', c: [220, 255, 220] },
]

const sbw = 30, sbh = 18, sgap = 5
let sx = ML + 2
const sty = y

steps.forEach((s, i) => {
    setFill(s.c)
    setDraw(C.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(sx, sty, sbw, sbh, 2, 2, 'FD')
    setColor(C.heading)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    const sl = doc.splitTextToSize(s.label, sbw - 3)
    doc.text(sl, sx + sbw/2, sty + sbh/2 - (sl.length-1)*2.5 + 2, { align: 'center' })
    if (i < 2) {
        arrow(sx + sbw, sty + sbh/2, sx + sbw + sgap, sty + sbh/2)
    }
    sx += sbw + sgap
})

// branch from step 3
const step3x = ML + 2 + (sbw + sgap) * 2
const branchY = sty + sbh + 4
setDraw(C.muted)
doc.setLineWidth(0.3)
doc.line(step3x + sbw/2, sty + sbh, step3x + sbw/2, branchY)
doc.line(step3x + sbw/2, branchY, step3x - sbw/2 - sgap, branchY)
doc.line(step3x + sbw/2, branchY, step3x + sbw/2 + sbw + sgap, branchY)
arrow(step3x - sbw/2 - sgap, branchY, step3x - sbw/2 - sgap, branchY + 4)
arrow(step3x + sbw/2 + sbw + sgap, branchY, step3x + sbw/2 + sbw + sgap, branchY + 4)

// yes/no labels
doc.setFont('helvetica', 'italic')
doc.setFontSize(7)
setColor(C.green)
doc.text('Yes', step3x - sbw/2 - sgap - 1, branchY - 1.5)
setColor(C.red)
doc.text('No', step3x + sbw/2 + sbw + sgap + 1, branchY - 1.5)

// step 4 and 5 boxes below
const s4x = step3x - sbw - sgap, s5x = step3x + sbw + sgap
box('Add item to\nexisting Draft PO', s4x, sbw, branchY + 4, sbh, [220, 255, 220], C.green)
box('Create new\nDraft PO', s5x, sbw, branchY + 4, sbh, [220, 255, 220], C.green)

y = branchY + sbh + 12
setColor(C.black)

space(2)
bullet('Suggested order quantity = Reorder Qty × 2 (enough to last until next delivery)')
bullet('If two items from the same vendor both need reordering, they are added to one PO — not two.')
bullet('Auto-generated POs have status DRAFT. Staff must review and send manually.')
bullet('Staff can edit quantities before sending.')
space(2)
note('Auto PO saves time — especially for fast-moving accessories like gloves or oil filters that run out regularly. Set a sensible Reorder Qty based on how often you sell the item and how long your supplier takes to deliver.')

newPage()
// ══════════════════════════════════════════════════════════════════════════
// PAGE — PURCHASE ORDERS
// ══════════════════════════════════════════════════════════════════════════
h1('4.  Purchase Orders — Full Flow')

h2('4.1  PO Status Lifecycle')
space(2)

// status flow
const statuses = ['DRAFT', 'REVIEWED', 'SENT', 'PARTIAL', 'RECEIVED']
const sColors = [
    [180,180,200], [150,190,220], [80,140,200], [220,160,60], [60,170,100]
]
const stW = 30, stH = 12, stGap = 4
let stX = ML + 3
const stY = y

statuses.forEach((s, i) => {
    setFill(sColors[i])
    setDraw(C.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(stX, stY, stW, stH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setColor(C.white)
    doc.text(s, stX + stW/2, stY + stH/2 + 2, { align: 'center' })
    if (i < statuses.length - 1 && i !== 2) {
        arrow(stX + stW, stY + stH/2, stX + stW + stGap, stY + stH/2)
    }
    stX += stW + stGap
})

// SENT branches to PARTIAL and RECEIVED
const sentX = ML + 3 + (stW + stGap) * 2
const partX = ML + 3 + (stW + stGap) * 3
const recvX = ML + 3 + (stW + stGap) * 4
const brY2 = stY + stH + 5

setDraw(C.muted)
doc.setLineWidth(0.3)
doc.line(sentX + stW/2, stY + stH, sentX + stW/2, brY2)
doc.line(sentX + stW/2, brY2, partX + stW/2, brY2)
doc.line(sentX + stW/2, brY2, recvX + stW/2, brY2)
arrow(partX + stW/2, brY2, partX + stW/2, brY2 + 2)
arrow(recvX + stW/2, brY2, recvX + stW/2, brY2 + 2)

// partial → received
setDraw(C.muted)
const pEndX = partX + stW
arrow(pEndX, stY + stH/2, recvX, stY + stH/2)

doc.setFont('helvetica', 'italic')
doc.setFontSize(7)
setColor(C.orange)
doc.text('some items\nmissing', partX + stW/2 - 8, brY2 - 4)
setColor(C.green)
doc.text('all items\ndelivered', recvX + stW/2 - 8, brY2 - 4)
setColor(C.muted)
doc.text('final delivery\nreceived', partX + stW + 1, stY + stH/2 - 4)

y = stY + stH + 22
setColor(C.black)

h2('4.2  Creating a Purchase Order')
bullet('Staff selects vendor, adds line items (article number, quantity, cost per unit)')
bullet('System calculates line totals and overall PO total automatically')
bullet('PO is saved as DRAFT — no email sent yet')
bullet('PO ID is generated in format: PO-{DEALER TAG}-{YEAR}-{NNN}  e.g. PO-AVA-2026-001')
space(2)
note('The dealer tag in the PO ID (e.g. AVA) is configured in dealership settings. It identifies which dealer created the order at a glance.')

space(4)
h2('4.3  Sending the PO — Outbound Email')
body('When staff clicks "Send", the system:')
bullet('Generates a PDF of the full PO with all line items, quantities, costs and delivery address')
bullet('Sends it as an email attachment to the supplier\'s email address (configured in vendor settings)')
bullet('Sets the email Reply-To address to the dealership\'s inbound delivery address (see Email Routing section)')
bullet('Sends a silent copy (BCC) to the dealer\'s own email for their records')
bullet('Updates PO status from DRAFT/REVIEWED to SENT')
space(2)
warn('The supplier email address must be set correctly in the vendor/supplier settings. If it is missing or wrong, the PO email will fail to send and the supplier will not receive it.')

newPage()
// ══════════════════════════════════════════════════════════════════════════
// PAGE — SUPPLIER SETTINGS
// ══════════════════════════════════════════════════════════════════════════
h1('5.  Supplier Settings — Critical Configuration')
body('Before the system can automatically send POs and receive delivery notes for a supplier, two email addresses must be configured in the Settings page. Without these, the automation breaks.')
space(4)

h2('5.1  Supplier Delivery Note Email')
body('This is the email address the supplier uses to send delivery notes (PDFs) when they dispatch goods. The system uses this to identify which supplier sent the email when a delivery arrives.')
space(2)
bullet('Set in: Settings → Suppliers → [Supplier Name] → Delivery Note Email')
bullet('Example: dispatch@vartex.se')
bullet('Must match the "From" address the supplier uses when emailing delivery notes')
space(2)
warn('If this is not set, when a delivery note email arrives from the supplier, the system cannot identify which supplier or which dealership it belongs to. The email will be flagged as unmatched and no goods receipt will be created.')

space(4)
h2('5.2  Supplier Invoice Email')
body('This is the email address the supplier uses to send invoices. The system stores these separately from delivery notes — invoices go to accounts payable, delivery notes go to goods receipts.')
space(2)
bullet('Set in: Settings → Suppliers → [Supplier Name] → Invoice Email')
bullet('Example: invoices@vartex.se')
bullet('Can be the same as the delivery note email or different')
space(2)
warn('If the invoice email is not set, invoice emails from the supplier will not be matched and will not be stored in the accounts payable section.')

space(4)
h2('5.3  What happens if these are not configured')

const fw = [55, 110]
let fr = y
tableRow(['Scenario', 'What happens'], fw, fr, true); fr += 7
const frows = [
    ['No delivery email set', 'Goods receipt not created. Stock not updated. Email flagged.'],
    ['Wrong delivery email', 'Email matched to wrong supplier or unmatched entirely.'],
    ['No invoice email set', 'Invoice stored as unknown. Manual processing required.'],
    ['Vendor name mismatch', 'Delivery note cannot be linked to a PO even if PO exists.'],
    ['No supplier in system', 'Dealership falls back to single-tenant guess — unreliable.'],
]
frows.forEach(r => { tableRow(r, fw, fr); fr += 7 })
y = fr + 6

note('The supplier name in the system must match exactly what appears in delivery note emails. Vendors are matched by email domain (e.g. @vartex.se). The name is used to link delivery notes to open POs when no PO reference is in the email.')

// ══════════════════════════════════════════════════════════════════════════
// PAGE — EMAIL ROUTING
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('6.  Email Routing — How Delivery Notes Reach the Right Dealer')

h2('6.1  The Problem')
body('bikeme.now serves multiple dealers. When a delivery note email arrives, the system must figure out which dealer it belongs to before processing it. This is called dealership resolution.')
space(2)

h2('6.2  Plus-Addressing — The Primary Method')
body('When AVA MC sends a PO to a supplier, the Reply-To in the email is set to a special address:')
space(2)
setFill(C.lightgrey)
setDraw(C.border)
doc.setLineWidth(0.3)
doc.roundedRect(ML, y, TW, 12, 2, 2, 'FD')
doc.setFont('courier', 'bold')
doc.setFontSize(10)
setColor(C.heading)
doc.text('delivery+3f8a-b21c-abc-001@inbound.bikeme.now', PW/2, y + 7.5, { align: 'center' })
y += 16

body('The UUID part (3f8a-b21c-abc-001) is the Dealership ID. When the supplier hits Reply to respond, this address is in the To field. The system reads the UUID and instantly knows the delivery belongs to AVA MC.')
space(2)
note('Plus-addressing is the most reliable method. It works automatically when the supplier replies to a PO email. No manual setup needed per supplier.')

space(4)
h2('6.3  Dealership Resolution — 4-Step Priority')
body('If the supplier composes a fresh email (not a reply), there is no plus-address. The system falls back through these steps:')
space(3)

const steps6 = [
    ['Step 1 — Plus Address (most reliable)', 'Read delivery+{UUID}@ from the To field. UUID = Dealership ID. Done.', C.green],
    ['Step 2 — PO Reference', 'Extract PO number from email subject, body, or PDF (e.g. "Er referens: PO-AVA-2026-001"). Look up that PO in the database. Get dealership from the PO record.', C.sub],
    ['Step 3 — Vendor Email Match', 'Match sender email domain against known supplier records in the system. If found, get dealership from the supplier record.', C.orange],
    ['Step 4 — Single Dealer Fallback', 'If only one dealership exists in the system, assume it belongs to them. (Only safe for single-dealer setups.)', C.red],
]

steps6.forEach(([title, desc, col]) => {
    checkY(22)
    setFill(C.white)
    setDraw(col)
    doc.setLineWidth(0.5)
    doc.roundedRect(ML, y, TW, 19, 2, 2, 'FD')
    setColor(col)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, ML + 4, y + 6)
    setColor(C.black)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const dl = doc.splitTextToSize(desc, TW - 8)
    doc.text(dl, ML + 4, y + 12)
    y += 22
})

newPage()
h2('6.4  Email Routing Diagram — Full Flow')
space(2)

// Full email routing diagram using text boxes
const boxW = 50, boxH = 14
const col1x = ML, col2x = ML + 60, col3x = ML + 120

// Supplier
box('Supplier sends\ndelivery note email\n+ PDF attachment', col2x, boxW, y, boxH, [220,235,255], C.heading)
arrow(col2x + boxW/2, y + boxH, col2x + boxW/2, y + boxH + 6)
y += boxH + 10

// Postmark
box('Postmark\n(inbound.bikeme.now)\nreceives email', col2x, boxW, y, boxH, C.lightgrey, C.black)
arrow(col2x + boxW/2, y + boxH, col2x + boxW/2, y + boxH + 6)
y += boxH + 10

// Webhook
box('/api/webhooks/\ninbound\n(Next.js API)', col2x, boxW, y, boxH, [255,245,220], C.orange)
arrow(col2x + boxW/2, y + boxH, col2x + boxW/2, y + boxH + 6)
y += boxH + 10

// Resolution
box('Resolve\nDealership\n(4-step priority)', col2x, boxW, y, boxH, [220,255,230], C.green)

// side branches
const resY = y
setDraw(C.muted)
doc.setLineWidth(0.25)
doc.line(col2x, resY + boxH/2, col2x - 6, resY + boxH/2)
box('Plus address\nfound ✓', ML, 45, resY - 4, 12, [220,255,220], C.green)
doc.line(MR, resY + boxH/2, MR + 0, resY + boxH/2)
box('PO reference\nextracted ✓', col3x + 5, 45, resY - 4, 12, [220,255,220], C.green)

arrow(col2x + boxW/2, y + boxH, col2x + boxW/2, y + boxH + 6)
y += boxH + 10

// Route
box('Route by email\naddress type', col2x, boxW, y, boxH, C.lightblue, C.heading)
const routeY = y
const routeArrY = y + boxH + 5
setDraw(C.muted)
doc.line(col2x + boxW/2, y + boxH, col2x + boxW/2, routeArrY)
doc.line(ML + 20, routeArrY, col3x + 20, routeArrY)
arrow(ML + 20, routeArrY, ML + 20, routeArrY + 4)
arrow(col3x + 20, routeArrY, col3x + 20, routeArrY + 4)

doc.setFont('helvetica', 'italic')
doc.setFontSize(7.5)
setColor(C.muted)
doc.text('delivery@...', ML + 2, routeArrY - 1.5)
doc.text('invoice@...', col3x + 2, routeArrY - 1.5)

y += boxH + 9

box('/api/goods-receipt\nProcess delivery\nnote + PDF', ML, 50, y, 16, [220,245,220], C.green)
box('Store in\naccounts_payable\n(invoices)', col3x, 50, y, 16, C.lightgrey, C.black)
y += 20

arrow(ML + 25, y, ML + 25, y + 5)
y += 8
box('Create Goods\nReceipt record\n+ notify dealer', ML, 50, y, 16, [200,230,255], C.heading)
y += 24

// ══════════════════════════════════════════════════════════════════════════
// PAGE — DELIVERY NOTE PROCESSING
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('7.  Delivery Note Processing — How PDFs are Read')

h2('7.1  PDF Text Extraction')
body('When a delivery note PDF arrives, the system extracts all text from it using a library called pdf-parse. This turns the PDF into plain text that the system can analyse.')
space(2)
note('Important: pdf-parse only works on digital PDFs (text-based). If a supplier sends a scanned image PDF (a photo of a paper delivery note), no text can be extracted. The system will fall back to any text in the email body.')

space(4)
h2('7.2  What is Extracted from the PDF')

const ew = [50, 55, 65]
let er = y
tableRow(['Field', 'Swedish label', 'How it is used'], ew, er, true); er += 7
const erows = [
    ['Supplier name', 'Avsändare / From', 'Linked to vendor record'],
    ['Delivery note no.', 'Leveransnummer / Följesedelnr', 'Stored as reference'],
    ['PO reference', 'Er referens / Ordernummer', 'Matched to system PO'],
    ['Delivery date', 'Leveransdatum', 'Stored as received date'],
    ['Article number', 'Art nr', 'Matched to inventory'],
    ['Description', 'Benämning', 'Item name stored'],
    ['Ordered qty', 'Beställt', 'Used for backorder calc'],
    ['Delivered qty', 'Lev ant', 'Stock is updated by this'],
]
erows.forEach(r => { tableRow(r, ew, er); er += 7 })
y = er + 6

h2('7.3  Three Extraction Patterns')
body('Different suppliers generate PDFs differently. The system uses three patterns to handle this:')
space(2)
bullet('Pattern A — Well-spaced tables: article number, then 2+ spaces, then description, then quantities. Works for most professional PDF generators.')
bullet('Pattern B — Loosely formatted: any line starting with a part-number-like token. Works for simpler PDF layouts.')
bullet('Pattern C — No-space format: when pdf-parse returns text with no spaces between columns (common with jsPDF-generated files). Uses article number structure (e.g. 501190Z005-A5) to split the line.')
space(2)
warn('If none of the three patterns match the supplier\'s PDF format, items will show as 0 units received. The raw extracted text is logged in Vercel logs to help diagnose and add a new pattern.')

newPage()
h1('8.  Backorder Logic')
body('A backorder occurs when a supplier delivers fewer items than what was ordered in the PO. The system tracks this automatically.')
space(4)

h2('8.1  How Backorders are Created')
body('When a delivery note arrives and is matched to a PO:')
bullet('For each PO line item, the system compares: ordered quantity vs delivered quantity')
bullet('If delivered < ordered → a backorder row is created with received_qty = 0 and backorder_qty = difference')
bullet('PO status is changed to PARTIAL')
bullet('The goods receipt shows a "PO Incomplete — awaiting backorder" badge')
space(4)

// Backorder diagram
setFill(C.lightblue)
setDraw(C.border)
doc.setLineWidth(0.3)
doc.roundedRect(ML, y, TW, 52, 2, 2, 'FD')
doc.setFont('helvetica', 'bold')
doc.setFontSize(9)
setColor(C.heading)
doc.text('Example: PO ordered 2 items', ML + 5, y + 8)

doc.setFont('courier', 'normal')
doc.setFontSize(8.5)
setColor(C.black)
doc.text('PO Line Items:      Knox Jacket M  qty: 1    Knox Jacket L  qty: 1', ML + 5, y + 16)
doc.text('Delivery Note 1:    Knox Jacket M  qty: 1    Knox Jacket L  qty: 0', ML + 5, y + 23)

setColor(C.green)
doc.text('  Knox Jacket M  →  received 1  backorder 0  ✓ complete', ML + 5, y + 31)
setColor(C.orange)
doc.text('  Knox Jacket L  →  received 0  backorder 1  ⏳ backordered', ML + 5, y + 38)

setColor(C.sub)
doc.setFont('helvetica', 'bold')
doc.text('PO status → PARTIAL', ML + 5, y + 46)
y += 57

h2('8.2  When a Backorder is Fulfilled')
body('When the next delivery note arrives with the backordered item:')
bullet('System checks all previously approved receipts for this PO')
bullet('Calculates total received so far per article number')
bullet('If total received + new delivery = ordered qty → backorder is fulfilled')
bullet('If all PO lines are now fulfilled → PO status changes to RECEIVED')
space(2)
note('The system never loses track of partial deliveries. Multiple deliveries against one PO are all tracked and totalled correctly.')

// ══════════════════════════════════════════════════════════════════════════
// PAGE — APPROVAL
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('9.  Goods Receipt Approval & Stock Update')

h2('9.1  Two-Stage Process')
body('Stock is never updated automatically when a delivery note arrives. It requires manual approval by a manager or admin. This prevents wrong quantities from affecting stock records.')
space(3)

const stages = [
    ['Stage 1 — Goods Receipt Created', 'Status: Pending Approval\n• System creates receipt from PDF\n• Items listed with quantities\n• Stock NOT changed yet\n• Dealer notified by email + in-app', [255,248,220], C.orange],
    ['Stage 2 — Admin Reviews', 'Admin opens the receipt in the system\n• Checks items and quantities against physical delivery\n• Sees any backorder rows\n• Decides to Approve or Reject', C.lightblue, C.sub],
    ['Stage 3 — Approve or Reject', 'APPROVE → stock updated immediately\nREJECT  → no stock change, reason recorded\n\nPO status auto-updated:\n• All items received → RECEIVED\n• Backorders remain → PARTIAL', [220,255,220], C.green],
]

stages.forEach(([title, desc, fillC, textC]) => {
    checkY(30)
    setFill(fillC)
    setDraw(C.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(ML, y, TW, 28, 2, 2, 'FD')
    setColor(textC)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(title, ML + 5, y + 7)
    setColor(C.black)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const dl = doc.splitTextToSize(desc, TW - 8)
    doc.text(dl, ML + 5, y + 13)
    y += 31
})

space(3)
h2('9.2  Stock Update Logic')
body('When approved, for each item in the goods receipt where received_qty > 0:')
bullet('System identifies the inventory type from the article number (MC- / SP- / ACC-)')
bullet('Fetches current stock from the correct table')
bullet('Adds received_qty to current stock')
bullet('Backorder rows (received_qty = 0) are skipped — no stock change')
space(2)
note('Backordered items do not update stock. Only physically received items (received_qty > 0) trigger a stock change.')

// ══════════════════════════════════════════════════════════════════════════
// PAGE — WHY POSTMARK
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('10.  Email Infrastructure — Why Postmark & Other Options')

h2('10.1  Why Postmark is Used (Not Gmail API)')
body('Postmark is a specialist email service built for exactly this kind of automated email processing. Here is why it was chosen over Gmail API:')
space(3)

const pw2 = [80, 88]
let pr = y
tableRow(['Postmark', 'Gmail API'], pw2, pr, true); pr += 7
const prows = [
    ['Receives email → sends webhook to your API automatically', 'Requires polling (checking inbox every few seconds) or Pub/Sub setup'],
    ['PDF attachment already in base64 in the webhook payload', 'You must fetch the attachment separately via another API call'],
    ['MIME parsing done for you — plain JSON payload', 'You parse raw MIME email format yourself'],
    ['Plus-addressing works natively for dealer routing', 'No automatic routing — all emails go to one inbox'],
    ['Built for transactional/automated email', 'Built for human email — less suitable for automation'],
    ['Simple setup: one webhook URL in dashboard', 'Requires OAuth2 credentials + Google Cloud Pub/Sub'],
    ['Cost: ~$15/month (or free tier: 100 emails/month)', 'Free — but significant engineering effort to implement'],
]
prows.forEach(r => { tableRow(r, pw2, pr); pr += 7 })
y = pr + 5

note('For a dealership receiving a few delivery notes per week, Postmark\'s free tier (100 emails/month) is more than enough. The engineering time saved vs Gmail API far outweighs the small cost at higher volume.')

space(5)
h2('10.2  Other Inbound Email Options')

const ow = [38, 38, 38, 50]
let or2 = y
tableRow(['Service', 'Cost', 'Difficulty', 'Notes'], ow, or2, true); or2 += 7
const orows = [
    ['Postmark (current)', 'Free / $15/mo', 'Easy', 'Best overall for this use case'],
    ['Mailgun', 'Free 1000/mo', 'Easy', 'Best drop-in Postmark replacement'],
    ['SendGrid', 'Free 100/day', 'Easy', 'Popular, slightly more complex'],
    ['Cloudflare Workers', 'Free', 'Medium', 'Best if domain on Cloudflare'],
    ['AWS SES + SNS', '~$0.10/1000', 'Hard', 'Best for large scale'],
    ['Gmail API', 'Free', 'Hard', 'Not recommended — see above'],
]
orows.forEach(r => { tableRow(r, ow, or2); or2 += 7 })
y = or2 + 6

note('bikeme.now domain (bikeme.now) is on Namecheap. Cloudflare Workers would require changing DNS/nameservers. Mailgun is the easiest alternative if Postmark needs to be replaced — MX records are added in Namecheap and code changes are minimal.')

// ══════════════════════════════════════════════════════════════════════════
// PAGE — CLAUDE API
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('11.  PDF Extraction Improvement — Claude API')

h2('11.1  Current Limitation')
body('The current PDF extraction uses three regex patterns (A, B, C). This works for known supplier formats but will fail for new suppliers with different layouts, Swedish special characters in unexpected places, or unusual column ordering.')
space(2)
body('Estimated failure rate: 1 in 5 new suppliers will have extraction issues. Each requires a new pattern to be coded and deployed.')
space(4)

h2('11.2  Claude API Solution')
body('Instead of regex, the extracted PDF text (or the PDF file itself) is sent to Claude — Anthropic\'s AI model. Claude understands natural language and tables in any format, any language, and returns clean structured JSON.')
space(3)

setFill(C.lightblue)
setDraw(C.border)
doc.setLineWidth(0.3)
doc.roundedRect(ML, y, TW, 42, 2, 2, 'FD')
doc.setFont('helvetica', 'bold')
doc.setFontSize(9)
setColor(C.heading)
doc.text('How it works:', ML + 5, y + 7)
doc.setFont('helvetica', 'normal')
doc.setFontSize(8.5)
setColor(C.black)
const claudeSteps = [
    '1. PDF text is extracted by pdf-parse (as now)',
    '2. Raw text is sent to Claude API with a prompt:',
    '   "Extract all line items. Return JSON: [{article_number, name, ordered_qty, received_qty}]"',
    '3. Claude returns clean structured data regardless of PDF layout or language',
    '4. System uses the JSON directly — no regex needed',
    '5. Fallback: if Claude API fails, existing patterns A/B/C are used as backup',
]
claudeSteps.forEach((s, i) => {
    doc.text(s, ML + 5, y + 14 + i * 5)
})
y += 48

h2('11.3  Cost & Setup')
bullet('Install: npm install @anthropic-ai/sdk')
bullet('Add ANTHROPIC_API_KEY to environment variables (Vercel + .env.local)')
bullet('Cost per delivery note: approximately $0.001 — $0.005 (less than 1 cent)')
bullet('For 100 delivery notes/month: less than $0.50/month total')
space(2)

const cw = [55, 55, 58]
let cr = y
tableRow(['Approach', 'Works for new suppliers', 'Maintenance needed'], cw, cr, true); cr += 7
tableRow(['Current (regex patterns)', 'Only known formats', 'New pattern per supplier'], cw, cr); cr += 7
tableRow(['Claude API', 'Any format, any language', 'None — self-adapting'], cw, cr); cr += 7
y = cr + 6

note('Claude API is the recommended long-term solution. It eliminates all regex maintenance, handles Swedish / Norwegian / Danish / Arabic labels automatically, and works even when column order varies between suppliers.')

// ══════════════════════════════════════════════════════════════════════════
// PAGE — SUGGESTIONS
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('12.  Suggestions & Recommended Improvements')

const suggestions = [
    ['Claude API for PDF Extraction', 'Replace regex patterns with Claude API calls. Eliminates all supplier-specific pattern coding. Handles any language and any table format automatically.', 'High', C.red],
    ['Scanned PDF Support (OCR)', 'Many suppliers still fax or scan delivery notes. Add OCR (via Claude Vision or AWS Textract) so image-based PDFs are also processed automatically.', 'High', C.red],
    ['Supplier Portal', 'Give suppliers a simple web portal to upload delivery notes directly instead of emailing PDFs. Eliminates email parsing entirely for willing suppliers.', 'Medium', C.orange],
    ['Low Stock Dashboard', 'A dedicated view showing all items below reorder qty across all categories, with one-click PO creation for all items from the same vendor.', 'Medium', C.orange],
    ['PO Approval Workflow', 'Add a two-step PO approval: manager creates → senior manager approves before sending to supplier. Prevents unauthorised orders.', 'Medium', C.orange],
    ['Email Delivery Confirmation', 'Track whether the PO email was opened/delivered by the supplier. If not opened after 24h, send a reminder automatically.', 'Low', C.sub],
    ['Move to Mailgun (optional)', 'If Postmark cost becomes a concern at higher volume, Mailgun\'s free tier (1000 emails/month) is a near-identical drop-in replacement.', 'Low', C.sub],
    ['VIN Barcode Scanning', 'Allow staff to scan VIN barcodes on motorcycle frames using a mobile camera when adding inventory, instead of typing 17 characters manually.', 'Low', C.sub],
]

suggestions.forEach(([title, desc, priority, col]) => {
    checkY(24)
    setFill(C.white)
    setDraw(col)
    doc.setLineWidth(0.4)
    doc.roundedRect(ML, y, TW, 20, 2, 2, 'FD')

    setFill(col)
    doc.roundedRect(ML, y, 18, 20, 2, 2, 'F')
    doc.rect(ML + 12, y, 6, 20, 'F')

    setColor(C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    const pl = doc.splitTextToSize(priority, 14)
    doc.text(pl, ML + 9, y + 8, { align: 'center' })

    setColor(C.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, ML + 22, y + 6.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const dl = doc.splitTextToSize(desc, TW - 26)
    doc.text(dl, ML + 22, y + 13)
    y += 23
})

// ══════════════════════════════════════════════════════════════════════════
// FINAL PAGE — QUICK REFERENCE
// ══════════════════════════════════════════════════════════════════════════
newPage()
h1('Quick Reference — System Summary')
space(2)

h2('Key ID Formats')
const qw = [45, 45, 80]
let qr = y
tableRow(['Type', 'Format', 'Example'], qw, qr, true); qr += 7
const qrows = [
    ['Dealership', 'UUID (auto)', '3f8a-b21c-4d9e-abc1-001234567890'],
    ['Purchase Order', 'PO-{TAG}-{YEAR}-{NNN}', 'PO-AVA-2026-001'],
    ['Goods Receipt', 'GR-{TAG}-{YEAR}-{NNN}', 'GR-AVA-2026-015'],
    ['Motorcycle', 'MC-{NNNN}', 'MC-0042'],
    ['Spare Part', 'SP-{NNNN}', 'SP-0103'],
    ['Accessory', 'ACC-{NNNN}', 'ACC-0017'],
    ['Inbound email', 'delivery+{UUID}@inbound.bikeme.now', 'delivery+3f8a@inbound.bikeme.now'],
]
qrows.forEach(r => { tableRow(r, qw, qr); qr += 7 })
y = qr + 6

h2('PO Status Reference')
const pw3 = [30, 140]
let pr3 = y
tableRow(['Status', 'Meaning'], pw3, pr3, true); pr3 += 7
const prows3 = [
    ['DRAFT', 'Created, not yet reviewed or sent to supplier'],
    ['REVIEWED', 'Reviewed by manager, ready to send'],
    ['SENT', 'Email sent to supplier, awaiting delivery'],
    ['PARTIAL', 'Some items delivered, others backordered'],
    ['RECEIVED', 'All ordered items delivered and approved'],
]
prows3.forEach(r => { tableRow(r, pw3, pr3); pr3 += 7 })
y = pr3 + 6

h2('Goods Receipt Status Reference')
const gw = [35, 135]
let gr2 = y
tableRow(['Status', 'Meaning'], gw, gr2, true); gr2 += 7
const grows = [
    ['Pending Approval', 'Receipt created from delivery note. Stock not updated yet.'],
    ['Approved', 'Admin approved. Stock updated. PO status auto-updated.'],
    ['Rejected', 'Admin rejected. No stock change. Reason recorded.'],
]
grows.forEach(r => { tableRow(r, gw, gr2); gr2 += 7 })
y = gr2 + 6

h2('Critical Settings Checklist')
bullet('Supplier delivery note email — must be set per vendor')
bullet('Supplier invoice email — must be set per vendor')
bullet('Article numbers in inventory — must match supplier\'s delivery note exactly')
bullet('Vendor name in system — must match what appears in supplier emails')
bullet('Postmark webhook URL — must point to correct environment (local or Vercel)')
bullet('POSTMARK_INBOUND_TOKEN — must match in Vercel environment variables')
bullet('ANTHROPIC_API_KEY — required if Claude API extraction is enabled')
space(3)

setFill(C.heading)
doc.rect(ML, y, TW, 18, 'F')
setColor(C.white)
doc.setFont('helvetica', 'bold')
doc.setFontSize(10)
doc.text('bikeme.now — Built for multi-dealer motorcycle management', PW/2, y + 7.5, { align: 'center' })
doc.setFont('helvetica', 'normal')
doc.setFontSize(8.5)
doc.text('Purchase Orders  •  Inventory  •  Delivery Notes  •  Email Automation  •  Stock Tracking', PW/2, y + 14, { align: 'center' })

// ── Write file ─────────────────────────────────────────────────────────────
const outPath = 'bikeme-system-documentation.pdf'
const pdfBytes = Buffer.from(doc.output('arraybuffer'))
fs.writeFileSync(outPath, pdfBytes)
console.log(`✓ Generated: ${outPath} (${(pdfBytes.length / 1024).toFixed(1)} KB) — ${pageNum} pages`)
