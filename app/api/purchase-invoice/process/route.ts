import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseDate(raw: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    const dmy = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    return new Date().toISOString().split('T')[0]
}

function generateInvoiceId(tag: string, existing: number): string {
    const year = new Date().getFullYear()
    return `PINV-${tag}-${year}-${String(existing + 1).padStart(3, '0')}`
}

// ── Extract invoice fields from raw text ─────────────────────────────────────

function extractInvoiceData(text: string) {
    // Invoice number
    const invMatch = text.match(
        /(?:invoice\s*(?:no|number|#)|faktura\s*(?:nr|nummer)|inv\s*(?:no|#))[:\s#]*([A-Z0-9][A-Z0-9\-\/]+)/i,
    )
    const supplier_invoice_number = invMatch?.[1]?.trim() ?? null

    // PO reference
    const poMatch = text.match(
        /(?:purchase\s*order|er\s*referens|ordernummer|po\s*(?:no|#|number)?|your\s*(?:order|reference|ref))[:\s#]*([A-Z0-9][A-Z0-9\-\/]*)/i,
    )
    const po_reference = poMatch?.[1]?.trim() ?? null

    // Invoice date
    const invDateMatch = text.match(
        /(?:invoice\s*date|fakturadatum|date)[:\s]+(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    )
    const invoice_date = invDateMatch
        ? normaliseDate(invDateMatch[1])
        : new Date().toISOString().split('T')[0]

    // Due date
    const dueMatch = text.match(
        /(?:due\s*date|payment\s*due|pay\s*by|förfallodatum|forfallsdato)[:\s]+(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    )
    const due_date = dueMatch ? normaliseDate(dueMatch[1]) : null

    // Total amount — match largest currency figure near total keywords
    const amountMatch = text.match(
        /(?:total|amount\s*due|grand\s*total|att\s*betala|to\s*pay|invoice\s*total)[^\d\n]{0,15}([\d\s.,]+)/i,
    )
    let amount = 0
    if (amountMatch) {
        const raw    = amountMatch[1].replace(/\s/g, '').replace(',', '.')
        const parsed = parseFloat(raw)
        if (!isNaN(parsed) && parsed > 0) amount = parsed
    }

    // Item count — lines that look like invoice line items
    const lines     = text.split('\n').map(l => l.trim()).filter(Boolean)
    const itemLines = lines.filter(l =>
        /^\d+\s+.{3,}/.test(l) ||
        /[A-Z]{1,4}[\d\-]+\s+.+\s+[\d.,]+/.test(l),
    )

    return { supplier_invoice_number, po_reference, invoice_date, due_date, amount, item_count: itemLines.length }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-webhook-secret')
    if (process.env.GOODS_RECEIPT_WEBHOOK_SECRET && secret !== process.env.GOODS_RECEIPT_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { dealership_id, vendor, pdf_base64, pdf_text, from_email } = await req.json()

    if (!dealership_id) {
        return NextResponse.json({ error: 'Missing dealership_id' }, { status: 400 })
    }

    const db = getSupabaseAdmin()

    // ── Parse PDF text ────────────────────────────────────────────────────────
    let rawText = pdf_text ?? ''
    if (!rawText && pdf_base64) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mod      = require('pdf-parse')
            const pdfParse = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text: string }>
            const buf      = Buffer.from(pdf_base64, 'base64')
            const parsed   = await pdfParse(buf)
            rawText = parsed.text ?? ''
        } catch (e) {
            console.warn('[purchase-invoice] PDF parse failed:', e)
        }
    }

    const extracted = extractInvoiceData(rawText)

    // ── Resolve PO + goods receipt links ─────────────────────────────────────
    let po_id:            string | null = null
    let goods_receipt_id: string | null = null

    if (extracted.po_reference) {
        const { data: po } = await db
            .from('purchase_orders')
            .select('id')
            .eq('dealership_id', dealership_id)
            .ilike('id', `%${extracted.po_reference}%`)
            .maybeSingle()

        if (po) {
            po_id = po.id

            // Find the most recent linked delivery note
            const { data: gr } = await db
                .from('goods_receipts')
                .select('id')
                .eq('dealership_id', dealership_id)
                .eq('po_id', po_id)
                .order('created_at', { ascending: false })
                .maybeSingle()

            if (gr) goods_receipt_id = gr.id
        }
    }

    // ── Generate PINV ID ──────────────────────────────────────────────────────
    const { data: dealer } = await db
        .from('dealerships')
        .select('name')
        .eq('id', dealership_id)
        .single()

    const tag = dealer?.name
        ? dealer.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
        : 'AVA'

    const { count } = await db
        .from('purchase_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('dealership_id', dealership_id)

    const today       = new Date().toISOString().split('T')[0]
    const invoiceId   = generateInvoiceId(tag, count ?? 0)
    const vendorLabel = vendor ?? from_email?.split('@')[1] ?? 'Unknown Vendor'

    const notes = [
        goods_receipt_id ? `Linked to delivery note ${goods_receipt_id}.` : null,
        extracted.item_count > 0 ? `${extracted.item_count} line item(s) detected.` : null,
        'Auto-imported via email.',
    ].filter(Boolean).join(' ')

    const { error } = await db.from('purchase_invoices').insert({
        id:                      invoiceId,
        dealership_id,
        supplier_invoice_number: extracted.supplier_invoice_number,
        po_id,
        vendor:                  vendorLabel,
        invoice_date:            extracted.invoice_date ?? today,
        due_date:                extracted.due_date     ?? today,
        amount:                  extracted.amount,
        status:                  'Pending',
        notes,
    })

    if (error) {
        console.error('[purchase-invoice] insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        ok:                      true,
        invoice_id:              invoiceId,
        supplier_invoice_number: extracted.supplier_invoice_number,
        po_id,
        goods_receipt_id,
        due_date:                extracted.due_date,
        amount:                  extracted.amount,
        item_count:              extracted.item_count,
    })
}
