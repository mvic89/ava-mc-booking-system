import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { extractDeliveryNoteWithAI } from '@/lib/extractWithAI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedItem {
    article_number: string | null
    name: string
    ordered_qty: number | null
    received_qty: number
    unit_cost: number | null
}

interface ParsedDeliveryNote {
    vendor: string | null
    delivery_note_number: string | null
    received_date: string | null
    po_reference: string | null
    items: ParsedItem[]
    notes: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateReceiptId(tag: string, existing: number): string {
    const year = new Date().getFullYear()
    return `GR-${tag.toUpperCase()}-${year}-${String(existing + 1).padStart(3, '0')}`
}

/** Convert a date string in various formats → YYYY-MM-DD */
function normaliseDate(raw: string): string | null {
    // Try ISO already
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    // MM/DD/YYYY
    const mdy = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
    return null
}

// ── PDF text extractor (server-side, no external API) ─────────────────────────

async function extractTextFromPDF(pdfBase64: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const buffer = Buffer.from(pdfBase64, 'base64')
    const result = await pdfParse(buffer)
    console.log('[goods-receipt] extracted PDF text:', result.text)
    return result.text
}

// ── Regex-based delivery note parser ─────────────────────────────────────────
//
// Works well when your vendors use consistent PDF templates.
// Each vendor section can be extended with their own patterns.
//
function parseDeliveryNoteText(text: string): ParsedDeliveryNote {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    // ── Vendor: first non-empty line, or after "From:" / "Supplier:" label ────
    let vendor: string | null = null
    const vendorLabel = text.match(/(?:from|supplier|vendor|sold by)[:\s]+([^\n]+)/i)
    if (vendorLabel) {
        vendor = vendorLabel[1].trim()
    } else {
        // Heuristic: first line that looks like a company name (has letters, not a number)
        vendor = lines.find(l => /[a-zA-Z]{3,}/.test(l) && !/^\d/.test(l)) ?? null
    }

    // ── Delivery note number ──────────────────────────────────────────────────
    // Supports English and Swedish field labels.
    // Uses word boundary (\b) before the capture group to avoid partial matches
    // inside Swedish compound words (e.g. "Leveransnummer" contains "dn" which
    // the old pattern matched mid-word, capturing "ummer" as the value).
    let delivery_note_number: string | null = null
    const dnMatch = text.match(
        /(?:delivery\s*note(?:\s*(?:no|#|number))?|packing\s*slip|despatch\s*note|följesedelnummer|leveransnummer|paketsedelnummer|sändningsnummer|fraktsedelnummer|dn\b)[:\s#]*\b([A-Z0-9][A-Z0-9\-\/]*)/i
    )
    if (dnMatch) delivery_note_number = dnMatch[1].trim()

    // ── PO reference ──────────────────────────────────────────────────────────
    // Supports English and Swedish field labels.
    // Anchored so "ordernummer" is matched as a whole word, not as a suffix.
    let po_reference: string | null = null
    const poMatch = text.match(
        /(?:purchase\s*order(?:\s*(?:no|#|number))?|your\s*order|kundordernummer|inköpsordernummer|beställningsnummer|köpordernummer|ordernummer|order\s*no|po\b)[:\s#]*\b([A-Z0-9][A-Z0-9\-\/]*)/i
    )
    if (poMatch) po_reference = poMatch[1].trim()

    // ── Date ─────────────────────────────────────────────────────────────────
    // Swedish: "Leveransdatum", "Orderdatum", "Datum"
    let received_date: string | null = null
    const dateMatch = text.match(/(?:delivery\s*date|despatch\s*date|ship\s*date|leveransdatum|avsändningsdatum|datum|date)[:\s]*(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i)
    if (dateMatch) received_date = normaliseDate(dateMatch[1])

    // ── Line items ────────────────────────────────────────────────────────────
    //
    // Strategy: look for table rows that contain a quantity number.
    // Common patterns:
    //   "SP-001   Brake Pads     10   5   120.00"
    //   "1   Oil Filter   Part#: OF-22   Qty: 3   Price: 45.00"
    //
    const items: ParsedItem[] = []

    // Pattern A: rows with article number prefix (SP-, MC-, ACC-, or alphanumeric SKU)
    const patternA = /([A-Z]{1,4}[\-\d]+)\s{2,}(.+?)\s{2,}(\d+)\s+(\d+)\s+([\d\s.,]+)?/g
    let match: RegExpExecArray | null
    while ((match = patternA.exec(text)) !== null) {
        const received = parseInt(match[4])
        if (isNaN(received) || received <= 0) continue
        items.push({
            article_number: match[1],
            name:           match[2].trim(),
            ordered_qty:    parseInt(match[3]) || null,
            received_qty:   received,
            unit_cost:      match[5] ? parseFloat(match[5].replace(/\s/g, '').replace(',', '.')) : null,
        })
    }

    // Pattern B: looser detection for any table format
    // Handles article numbers that start with digits (e.g. 501190Z005-A5, 692-3226221-10-6)
    if (items.length === 0) {
        for (const line of lines) {
            // Skip header lines (Swedish + English) and address/email lines
            if (/^(item|description|qty|quantity|article|part|price|amount|total|unit|art|benämning|artikel|storlek|färg|beställt|lev|delivery|ean)/i.test(line)) continue
            if (line.includes('|') || line.includes('@')) continue   // address or email line
            if (/^\d+\s*of\s*\d+/.test(line)) continue              // page number line
            if (line.length < 8) continue

            const tokens = line.split(/\s+/)
            if (tokens.length < 3) continue

            const firstToken = tokens[0]
            // Article number: 3+ chars, must have at least a letter OR a dash (not a plain integer)
            if (firstToken.length < 3) continue
            if (!/[A-Za-z\-]/.test(firstToken)) continue        // needs letter or dash
            if (/^\d+$/.test(firstToken)) continue              // plain integer = not an SKU
            if (!/^[A-Za-z0-9][A-Za-z0-9\-\.\/]*$/.test(firstToken)) continue  // safe chars only

            const rest = line.slice(firstToken.length).trim()

            // Scan tokens from right → find rightmost positive integer ≤ 999 (the received qty)
            // Skip decimals/prices and zeros
            const restTokens = rest.split(/\s+/).reverse()
            let received: number | null = null
            for (const tok of restTokens) {
                if (/^\d{1,4}$/.test(tok)) {
                    const n = parseInt(tok)
                    if (n > 0 && n <= 999) { received = n; break }
                }
            }
            if (!received) continue

            // Name: strip trailing numeric-only tokens (quantities, prices, dates)
            const namePart = rest.replace(/(?:\s+[\d.,]+)+\s*$/, '').trim()
            if (!namePart || namePart.length < 3 || !/[A-Za-z]/.test(namePart)) continue

            items.push({
                article_number: firstToken,
                name:           namePart,
                ordered_qty:    null,
                received_qty:   received,
                unit_cost:      null,
            })
        }
    }

    // Pattern C: no-space format from jsPDF (pdf-parse v1 output)
    // e.g. "501190Z005-A5SKYDDSTRÖJA KNOX URBANE PRO MK3 HEMSVART11"
    // Article number: starts with digits, has uppercase letters + dash groups
    if (items.length === 0) {
        const patternC = /^(\d+[A-Z]+\d+(?:-[A-Z][0-9]+)+)(.+?)(\d+)(\d+)\s*$/gm
        let matchC: RegExpExecArray | null
        while ((matchC = patternC.exec(text)) !== null) {
            const received = parseInt(matchC[4])
            if (isNaN(received) || received <= 0) continue
            items.push({
                article_number: matchC[1],
                name:           matchC[2].trim(),
                ordered_qty:    parseInt(matchC[3]) || null,
                received_qty:   received,
                unit_cost:      null,
            })
        }
    }

    // ── Notes: look for a "remarks" / "notes" section ────────────────────────
    let notes: string | null = null
    const notesMatch = text.match(/(?:notes?|remarks?|comments?)[:\s]+([^\n]{10,})/i)
    if (notesMatch) notes = notesMatch[1].trim()

    return { vendor, delivery_note_number, received_date, po_reference, items, notes }
}

// ── Inventory matching ────────────────────────────────────────────────────────

async function matchInventoryItem(
    db: ReturnType<typeof getSupabaseAdmin>,
    dealershipId: string,
    item: ParsedItem,
): Promise<string | null> {
    if (item.article_number) {
        for (const table of ['motorcycles', 'spare_parts', 'accessories'] as const) {
            const { data } = await db
                .from(table)
                .select('id')
                .eq('dealership_id', dealershipId)
                .eq('article_number', item.article_number)
                .maybeSingle()
            if (data) return data.id
        }
    }

    const nameLower = item.name.toLowerCase()
    for (const table of ['motorcycles', 'spare_parts', 'accessories'] as const) {
        const { data } = await db
            .from(table)
            .select('id, name')
            .eq('dealership_id', dealershipId)
        const match = data?.find((r: { id: string; name: string }) =>
            r.name.toLowerCase().includes(nameLower) || nameLower.includes(r.name.toLowerCase())
        )
        if (match) return match.id
    }

    return null
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const db = getSupabaseAdmin()

    // ── Parse body first (always) ─────────────────────────────────────────────
    let body: {
        dealership_id?: string
        pdf_base64?: string   // base64-encoded PDF bytes
        pdf_text?: string     // plain text fallback
        vendor?: string
        po_id?: string
        received_by?: string
    }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // ── Authenticate via webhook secret header ────────────────────────────────
    const secret = req.headers.get('x-webhook-secret')
    if (process.env.GOODS_RECEIPT_WEBHOOK_SECRET && secret !== process.env.GOODS_RECEIPT_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!body.dealership_id) {
        return NextResponse.json({ error: 'dealership_id is required' }, { status: 400 })
    }
    const dealership_id = body.dealership_id

    const { pdf_base64, pdf_text, vendor: vendorHint, po_id, received_by } = body

    if (!pdf_base64 && !pdf_text && !vendorHint) {
        return NextResponse.json({ error: 'pdf_base64, pdf_text, or vendor is required' }, { status: 400 })
    }

    // ── Extract delivery note data via Claude AI ──────────────────────────────
    let parsed
    let rawText = pdf_text ?? ''
    if (pdf_base64) {
        try {
            parsed = await extractDeliveryNoteWithAI(pdf_base64)
            console.log('[goods-receipt] AI extracted:', parsed)
        } catch (err) {
            console.warn('[goods-receipt] AI extraction failed, using regex fallback:', err)
            parsed = parseDeliveryNoteText(rawText)
        }
    } else {
        parsed = parseDeliveryNoteText(rawText)
    }

    // ── Resolve dealership name for receipt tag ───────────────────────────────
    const { data: dealer } = await db
        .from('dealerships')
        .select('name')
        .eq('id', dealership_id)
        .single()

    const tag = dealer?.name
        ? dealer.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
        : 'GR'

    const { count } = await db
        .from('goods_receipts')
        .select('id', { count: 'exact', head: true })
        .eq('dealership_id', dealership_id)

    const receiptId = generateReceiptId(tag, count ?? 0)

    // ── Match PO ──────────────────────────────────────────────────────────────
    // Outcomes:
    //   'matched_open'   — PO found and still open (Sent / Partial / Approved)
    //   'matched_closed' — PO found but already fully received or cancelled
    //   'fallback'       — no PO ref in note; linked to most-recent open PO by vendor
    //   'unmatched'      — PO ref present but not found in system
    //   'none'           — no PO ref and no vendor fallback matched
    const OPEN_STATUSES = ['Sent', 'Partial', 'Approved', 'Draft']
    const poReference = po_id ?? parsed.po_reference ?? null
    let matchedPoId:     string | null = null
    let matchedPoStatus: string | null = null
    let poMatchStatus: 'matched_open' | 'matched_closed' | 'fallback' | 'unmatched' | 'none' = 'none'

    if (poReference) {
        const { data: exactPO } = await db
            .from('purchase_orders')
            .select('id, status')
            .eq('dealership_id', dealership_id)
            .ilike('id', `%${poReference}%`)
            .maybeSingle()

        if (exactPO) {
            matchedPoId     = exactPO.id
            matchedPoStatus = exactPO.status
            poMatchStatus   = OPEN_STATUSES.includes(exactPO.status)
                ? 'matched_open'
                : 'matched_closed'
        } else {
            poMatchStatus = 'unmatched'
        }
    }

    // Fallback: link to most recent open PO from the same vendor (only when no ref was given)
    if (!matchedPoId && !poReference && (vendorHint ?? parsed.vendor)) {
        const vendorName = vendorHint ?? parsed.vendor ?? ''
        const { data: recentPO } = await db
            .from('purchase_orders')
            .select('id, status')
            .eq('dealership_id', dealership_id)
            .in('status', OPEN_STATUSES)
            .ilike('vendor', `%${vendorName}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        if (recentPO) {
            matchedPoId     = recentPO.id
            matchedPoStatus = recentPO.status
            poMatchStatus   = 'fallback'
        }
    }

    // ── Upload PDF to Supabase Storage ────────────────────────────────────────
    let pdfStorageUrl: string | null = null
    if (pdf_base64) {
        try {
            const pdfBuffer = Buffer.from(pdf_base64, 'base64')
            const fileName  = `${dealership_id}/${receiptId}.pdf`
            const { error: uploadError } = await db.storage
                .from('delivery-notes')
                .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })
            if (!uploadError) {
                const { data: urlData } = db.storage.from('delivery-notes').getPublicUrl(fileName)
                pdfStorageUrl = urlData?.publicUrl ?? null
            } else {
                console.warn('[goods-receipt] PDF upload failed:', uploadError.message)
            }
        } catch (e) {
            console.warn('[goods-receipt] PDF upload error:', e)
        }
    }

    // ── Insert header (pending_approval — stock is NOT updated until admin approves) ──
    const receivedDate = parsed.received_date ?? new Date().toISOString().split('T')[0]
    const vendor       = vendorHint ?? parsed.vendor ?? 'Unknown Vendor'

    const { error: receiptError } = await db.from('goods_receipts').insert({
        id:                   receiptId,
        dealership_id,
        po_id:                matchedPoId ?? poReference,
        vendor,
        delivery_note_number: parsed.delivery_note_number ?? null,
        received_date:        receivedDate,
        received_by:          received_by ?? null,
        notes:                parsed.notes ?? null,
        raw_text:             rawText,
        source:               'email_automation',
        status:               'pending_approval',
        pdf_url:              pdfStorageUrl,
    })

    if (receiptError) {
        console.error('Insert goods_receipt error:', receiptError)
        return NextResponse.json({ error: receiptError.message }, { status: 500 })
    }

    // ── Fetch PO line items (used as authoritative ordered_qty + backorder source) ─
    // The delivery note PDF rarely has a reliable "ordered qty" column (Swedish
    // PDFs use "Beställt" which our parser doesn't extract). The PO is the true
    // source of what was ordered. We also use it to detect items ordered but not
    // yet delivered (pure backorders — not present in the delivery note at all).
    type PoLine = {
        article_number: string
        name:           string
        order_qty:      number
        inventory_id:   string
        unit_cost:      number
    }
    let poLines: PoLine[] = []
    if (matchedPoId) {
        const { data: poLineData } = await db
            .from('po_line_items')
            .select('article_number, name, order_qty, inventory_id, unit_cost')
            .eq('po_id', matchedPoId)
        poLines = (poLineData ?? []) as PoLine[]
    }

    // Build lookup: article_number → PO line
    const poLineByArticle = new Map<string, PoLine>()
    for (const pl of poLines) {
        if (pl.article_number) poLineByArticle.set(pl.article_number.trim().toUpperCase(), pl)
    }

    // ── For partially-received POs: find what has already been delivered ───────
    // This prevents creating duplicate backorder rows for items already received
    // in a previous receipt against the same PO.
    const alreadyReceivedByArticle = new Map<string, number>()
    if (matchedPoId && matchedPoStatus === 'Partial') {
        const { data: prevReceipts } = await db
            .from('goods_receipts')
            .select('id')
            .eq('dealership_id', dealership_id)
            .eq('po_id', matchedPoId)
            .eq('status', 'approved')

        if (prevReceipts && prevReceipts.length > 0) {
            const prevIds = prevReceipts.map((r: { id: string }) => r.id)
            const { data: prevItems } = await db
                .from('goods_receipt_items')
                .select('article_number, received_qty')
                .in('receipt_id', prevIds)

            for (const pi of prevItems ?? []) {
                const key = (pi.article_number ?? '').trim().toUpperCase()
                alreadyReceivedByArticle.set(key, (alreadyReceivedByArticle.get(key) ?? 0) + pi.received_qty)
            }
        }
    }

    // ── Process line items (save only — no stock update until approved) ───────
    const results: {
        name: string
        received_qty: number
        ordered_qty: number | null
        backorder_qty: number
        inventory_id: string | null
        matched: boolean
    }[] = []

    // Track which PO lines have been covered by the delivery note
    const coveredPoArticles = new Set<string>()

    for (const item of parsed.items ?? []) {
        if (!item.name || item.received_qty <= 0) continue

        const artKey      = item.article_number?.trim().toUpperCase() ?? ''
        const poLine      = artKey ? poLineByArticle.get(artKey) : undefined
        const inventoryId = poLine?.inventory_id
            ?? await matchInventoryItem(db, dealership_id, item)

        // Use PO ordered qty when available — more reliable than PDF parsing
        const orderedQty   = poLine?.order_qty ?? item.ordered_qty ?? null
        const backorderQty = orderedQty !== null
            ? Math.max(0, orderedQty - item.received_qty)
            : 0

        if (artKey) coveredPoArticles.add(artKey)

        const { error: itemError } = await db.from('goods_receipt_items').insert({
            receipt_id:     receiptId,
            inventory_id:   inventoryId ?? null,
            article_number: item.article_number ?? null,
            name:           item.name,
            ordered_qty:    orderedQty,
            received_qty:   item.received_qty,
            backorder_qty:  backorderQty,
            unit_cost:      item.unit_cost ?? poLine?.unit_cost ?? null,
            matched:        !!inventoryId,
        })
        if (itemError) {
            console.error('[goods-receipt] item insert failed:', itemError.message, '— item:', item.name)
            continue
        }

        results.push({
            name:          item.name,
            received_qty:  item.received_qty,
            ordered_qty:   orderedQty,
            backorder_qty: backorderQty,
            inventory_id:  inventoryId ?? null,
            matched:       !!inventoryId,
        })
    }

    // ── Add backorder rows for PO lines NOT present in this delivery ──────────
    // For open POs   → full order_qty is the backorder
    // For partial POs → only the remaining quantity (order_qty − already received)
    // Skip lines already fully fulfilled by previous receipts
    for (const pl of poLines) {
        const artKey = pl.article_number?.trim().toUpperCase() ?? ''
        if (coveredPoArticles.has(artKey)) continue

        const prevReceived = alreadyReceivedByArticle.get(artKey) ?? 0
        const stillNeeded  = pl.order_qty - prevReceived
        if (stillNeeded <= 0) continue   // fully received in a previous receipt — skip

        const { error: boError } = await db.from('goods_receipt_items').insert({
            receipt_id:     receiptId,
            inventory_id:   pl.inventory_id ?? null,
            article_number: pl.article_number,
            name:           pl.name,
            ordered_qty:    pl.order_qty,
            received_qty:   0,
            backorder_qty:  stillNeeded,
            unit_cost:      pl.unit_cost ?? null,
            matched:        !!pl.inventory_id,
        })
        if (boError) {
            console.error('[goods-receipt] backorder row insert failed:', boError.message, '— item:', pl.name)
            continue
        }

        results.push({
            name:          pl.name,
            received_qty:  0,
            ordered_qty:   pl.order_qty,
            backorder_qty: stillNeeded,
            inventory_id:  pl.inventory_id ?? null,
            matched:       !!pl.inventory_id,
        })
    }

    // ── Update PO status immediately so the dealer sees it in the PO list ─────
    // Open PO + backorders present → Partial (supplier hasn't shipped everything)
    // Open PO + no backorders       → leave as-is (approve route will set Received)
    // Partial PO + backorders       → stays Partial
    // Partial PO + no backorders    → leave as-is (approve route will set Received)
    const hasAnyBackorder = results.some(r => r.backorder_qty > 0)
    const willCompletePo  = matchedPoId !== null && !hasAnyBackorder && results.length > 0

    if (matchedPoId && hasAnyBackorder && poMatchStatus === 'matched_open') {
        await db.from('purchase_orders')
            .update({ status: 'Partial' })
            .eq('id', matchedPoId)
            .eq('dealership_id', dealership_id)
            .in('status', ['Sent', 'Approved'])   // only advance forward, never downgrade
    }

    return NextResponse.json({
        ok:                     true,
        receipt_id:             receiptId,
        status:                 'pending_approval',
        po_id:                  matchedPoId,
        po_match_status:        poMatchStatus,
        po_reference_from_note: poReference,
        po_status:              matchedPoStatus,
        po_was_partial:         matchedPoStatus === 'Partial',
        will_complete_po:       willCompletePo,
        vendor,
        received_date:         receivedDate,
        items_processed:       results.length,
        items_matched:         results.filter(r => r.matched).length,
        items:                 results,
        raw_text_preview:      rawText.slice(0, 500),
    })
}
