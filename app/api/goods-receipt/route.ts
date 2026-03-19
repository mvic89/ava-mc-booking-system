import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

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
    const mod      = await import('pdf-parse')
    const pdfParse = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text: string }>
    const buffer   = Buffer.from(pdfBase64, 'base64')
    const result   = await pdfParse(buffer)
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
    let delivery_note_number: string | null = null
    const dnMatch = text.match(/(?:delivery\s*note|packing\s*slip|despatch\s*note|dn\s*(?:no|#|number)?)[:\s#]*([A-Z0-9\-\/]+)/i)
    if (dnMatch) delivery_note_number = dnMatch[1].trim()

    // ── PO reference ──────────────────────────────────────────────────────────
    let po_reference: string | null = null
    const poMatch = text.match(/(?:purchase\s*order|po\s*(?:no|#|number)?|your\s*order)[:\s#]*([A-Z0-9\-\/]+)/i)
    if (poMatch) po_reference = poMatch[1].trim()

    // ── Date ─────────────────────────────────────────────────────────────────
    let received_date: string | null = null
    const dateMatch = text.match(/(?:date|delivery\s*date|despatch\s*date|ship\s*date)[:\s]*(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i)
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

    // Pattern B: if pattern A found nothing, try looser row detection
    // Look for lines that have at least one number that could be a quantity
    if (items.length === 0) {
        for (const line of lines) {
            // Skip header-like lines
            if (/^(item|description|qty|quantity|article|part|price|amount|total|unit)/i.test(line)) continue

            const nums = line.match(/\b(\d{1,5})\b/g)
            if (!nums || nums.length < 1) continue

            // Last number = received qty, second-to-last = ordered qty (if two present)
            const received = parseInt(nums[nums.length - 1])
            if (isNaN(received) || received <= 0 || received > 9999) continue

            // Article number: alphanumeric token before the description
            const artMatch = line.match(/^([A-Z]{1,4}[\d\-]+)\s+/i)

            // Name: everything between art# and the first number block
            const nameMatch = line.replace(/^[A-Z]{1,4}[\d\-]+\s+/i, '').match(/^([A-Za-z][^\d]*[A-Za-z])/)

            if (!nameMatch) continue

            items.push({
                article_number: artMatch ? artMatch[1] : null,
                name:           nameMatch[1].trim(),
                ordered_qty:    nums.length >= 2 ? parseInt(nums[nums.length - 2]) : null,
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
        pdf_url?: string      // Zapier file URL — server fetches & parses it
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

    // ── Resolve dealership: token (Zapier) OR dealership_id + secret (direct) ─
    // URL format: /api/goods-receipt?token=<zapier_token>
    const token = new URL(req.url).searchParams.get('token')
    let dealership_id: string

    if (token) {
        const { data: dealer } = await db
            .from('dealerships')
            .select('id')
            .eq('zapier_token', token)
            .single()
        if (!dealer) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        dealership_id = dealer.id
    } else {
        const secret = req.headers.get('x-webhook-secret')
        if (process.env.GOODS_RECEIPT_WEBHOOK_SECRET && secret !== process.env.GOODS_RECEIPT_WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (!body.dealership_id) {
            return NextResponse.json({ error: 'token (query param) or dealership_id (body) is required' }, { status: 400 })
        }
        dealership_id = body.dealership_id
    }

    const { pdf_base64, pdf_url, pdf_text, vendor: vendorHint, po_id, received_by } = body

    if (!pdf_base64 && !pdf_url && !pdf_text) {
        return NextResponse.json({ error: 'pdf_url, pdf_base64, or pdf_text is required' }, { status: 400 })
    }

    // ── Extract text from PDF then parse ──────────────────────────────────────
    let rawText = pdf_text ?? ''

    if (pdf_url) {
        // Zapier sends the attachment as a URL — fetch it and parse
        try {
            const res    = await fetch(pdf_url)
            const buffer = Buffer.from(await res.arrayBuffer())
            const pdfParse = (await import('pdf-parse')).default
            rawText = (await pdfParse(buffer)).text
        } catch (err) {
            console.error('PDF URL fetch/parse error:', err)
            return NextResponse.json({ error: 'Failed to fetch or parse PDF from URL' }, { status: 422 })
        }
    } else if (pdf_base64) {
        try {
            rawText = await extractTextFromPDF(pdf_base64)
        } catch (err) {
            console.error('PDF text extraction error:', err)
            return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 422 })
        }
    }

    const parsed = parseDeliveryNoteText(rawText)

    // ── Resolve dealership name for tag (select name+zapier_token, reuse if token path already fetched) ──
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

    // ── Insert header ─────────────────────────────────────────────────────────
    const receivedDate = parsed.received_date ?? new Date().toISOString().split('T')[0]
    const vendor       = vendorHint ?? parsed.vendor ?? 'Unknown Vendor'

    const { error: receiptError } = await db.from('goods_receipts').insert({
        id:                   receiptId,
        dealership_id,
        po_id:                po_id ?? parsed.po_reference ?? null,
        vendor,
        delivery_note_number: parsed.delivery_note_number ?? null,
        received_date:        receivedDate,
        received_by:          received_by ?? null,
        notes:                parsed.notes ?? null,
        raw_text:             rawText,
        source:               'email_automation',
    })

    if (receiptError) {
        console.error('Insert goods_receipt error:', receiptError)
        return NextResponse.json({ error: receiptError.message }, { status: 500 })
    }

    // ── Process line items ────────────────────────────────────────────────────
    const results: { name: string; received_qty: number; inventory_id: string | null; matched: boolean }[] = []

    for (const item of parsed.items ?? []) {
        if (!item.name || item.received_qty <= 0) continue

        const inventoryId = await matchInventoryItem(db, dealership_id, item)

        await db.from('goods_receipt_items').insert({
            receipt_id:     receiptId,
            inventory_id:   inventoryId,
            article_number: item.article_number ?? null,
            name:           item.name,
            ordered_qty:    item.ordered_qty ?? null,
            received_qty:   item.received_qty,
            unit_cost:      item.unit_cost ?? null,
            matched:        !!inventoryId,
        })

        if (inventoryId) {
            const table = inventoryId.startsWith('MC-') ? 'motorcycles'
                        : inventoryId.startsWith('SP-') ? 'spare_parts'
                        : 'accessories'

            const { data: current } = await db
                .from(table)
                .select('stock')
                .eq('id', inventoryId)
                .eq('dealership_id', dealership_id)
                .single()

            if (current) {
                await db.from(table)
                    .update({ stock: (current.stock ?? 0) + item.received_qty })
                    .eq('id', inventoryId)
                    .eq('dealership_id', dealership_id)
            }
        }

        results.push({ name: item.name, received_qty: item.received_qty, inventory_id: inventoryId, matched: !!inventoryId })
    }

    return NextResponse.json({
        ok:              true,
        receipt_id:      receiptId,
        vendor,
        received_date:   receivedDate,
        items_processed: results.length,
        items_matched:   results.filter(r => r.matched).length,
        items:           results,
        // Return raw text so you can inspect what was extracted
        raw_text_preview: rawText.slice(0, 500),
    })
}
