import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ServerClient } from 'postmark'
import { extractInvoiceWithAI, AIInvoiceResult } from '@/lib/extractWithAI'

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateInvoiceId(tag: string, existing: number): string {
    const year = new Date().getFullYear()
    return `PINV-${tag}-${year}-${String(existing + 1).padStart(3, '0')}`
}

// ── Regex fallback (used if AI call fails) ────────────────────────────────────

function extractInvoiceDataFallback(text: string): AIInvoiceResult {
    const parseNum = (s: string) => parseFloat(s.replace(/[ \t]/g, '').replace(',', '.')) || 0

    const invMatch = text.match(/(?:fakturanr|faktura\s*nr|invoice\s*(?:no|number|#))[.:\s#]*([A-Z0-9][A-Z0-9\-\/]+)/i)
    const supplier_invoice_number = invMatch?.[1]?.trim() ?? null

    const poMatch = text.match(/(?:er\s*referens|ert\s*ordernr|purchase\s*order|po\b)[:\s#]*([A-Z0-9][A-Z0-9\-\/]*)/i)
    const po_reference = poMatch?.[1]?.trim() ?? null

    const invDateMatch = text.match(/(?:fakturadatum|invoice\s*date)[:\s]+(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i)
    const invoice_date = invDateMatch?.[1] ?? new Date().toISOString().split('T')[0]

    const dueMatch = text.match(/(?:förfallodatum|förfallodag|due\s*date)[:\s]+(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i)
    const due_date = dueMatch?.[1] ?? null

    let amount = 0
    const totalPatterns = [
        /(?:att\s*betala|fakturabelopp|totalt\s*att\s*betala|amount\s*due)[^\d\n]{0,20}([\d .,]+)/i,
        /([\d .,]+)\s*SEK\s*$/im,
    ]
    for (const p of totalPatterns) {
        const m = text.match(p)
        if (m) { amount = parseNum(m[1]); if (amount > 0) break }
    }

    return { supplier_name: null, supplier_invoice_number, po_reference, po_references: [], invoice_date, due_date, amount, currency: 'SEK', lineItems: [] }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const body = await req.json()
    const { dealership_id, vendor, pdf_base64, pdf_text, from_email, dry_run } = body

    // ── Dry run: skip auth, just extract and return ───────────────────────────
    if (dry_run === true) {
        let rawText = pdf_text ?? ''
        if (!rawText && pdf_base64) {
            try {
                const pdfParse = (await import('pdf-parse')).default
                const buf      = Buffer.from(pdf_base64, 'base64')
                const parsed   = await pdfParse(buf)
                rawText        = parsed.text ?? ''
            } catch (e) {
                rawText = ''
            }
        }
        let extracted
        try {
            extracted = await extractInvoiceWithAI(pdf_base64)
        } catch (e) {
            console.warn('[dry-run] AI extraction failed, using fallback:', e)
            extracted = extractInvoiceDataFallback(rawText)
        }

        return NextResponse.json({ dry_run: true, extracted })
    }

    // ── Auth check for real webhook calls ────────────────────────────────────
    const secret = req.headers.get('x-webhook-secret')
    if (process.env.GOODS_RECEIPT_WEBHOOK_SECRET && secret !== process.env.GOODS_RECEIPT_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!dealership_id) {
        return NextResponse.json({ error: 'Missing dealership_id' }, { status: 400 })
    }

    if (!pdf_base64) {
        return NextResponse.json({ error: 'No PDF attachment found in email' }, { status: 422 })
    }

    const db = getSupabaseAdmin()

    // ── Extract invoice data via Claude AI ───────────────────────────────────
    let extracted
    try {
        extracted = await extractInvoiceWithAI(pdf_base64)
        console.log('[purchase-invoice] AI extracted:', extracted)
    } catch (e) {
        console.warn('[purchase-invoice] AI extraction failed, using fallback:', e)
        extracted = extractInvoiceDataFallback(pdf_text ?? '')
    }

    // ── Resolve PO + goods receipt links ─────────────────────────────────────
    // Support consolidated invoices (SAMLINGSFAKTURA) with multiple PO references
    let po_id:            string | null = null
    let goods_receipt_id: string | null = null
    let poTotalCost:      number | null = null
    let poFullyReceived                 = false
    const allPoRefs = extracted.po_references?.length
        ? extracted.po_references
        : extracted.po_reference ? [extracted.po_reference] : []

    const matchedPoIds: string[] = []

    for (const ref of allPoRefs) {
        const { data: po } = await db
            .from('purchase_orders')
            .select('id, total_cost, status')
            .eq('dealership_id', dealership_id)
            .ilike('id', `%${ref}%`)
            .maybeSingle()

        if (po) {
            matchedPoIds.push(po.id)
            if (!po_id) {
                // Primary PO = first matched
                po_id       = po.id
                poTotalCost = po.total_cost ?? null
                poFullyReceived = po.status === 'Received'

                const { data: grs } = await db
                    .from('goods_receipts')
                    .select('id')
                    .eq('dealership_id', dealership_id)
                    .eq('po_id', po.id)
                    .order('created_at', { ascending: false })
                if (grs && grs.length > 0) goods_receipt_id = grs[0].id
            }
        }
    }

    // ── Duplicate prevention ──────────────────────────────────────────────────
    if (extracted.supplier_invoice_number) {
        const { data: existing } = await db
            .from('purchase_invoices')
            .select('id')
            .eq('dealership_id', dealership_id)
            .eq('supplier_invoice_number', extracted.supplier_invoice_number)
            .maybeSingle()
        if (existing) {
            console.log(`[purchase-invoice] duplicate detected — ${extracted.supplier_invoice_number} already exists as ${existing.id}`)
            return NextResponse.json({ ok: true, duplicate: true, existing_id: existing.id })
        }
    }

    // ── Fallback amount from PO total_cost if extraction failed ──────────────
    const finalAmount = extracted.amount > 0
        ? extracted.amount
        : (poTotalCost ?? 0)

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

    const today     = new Date().toISOString().split('T')[0]
    const invoiceId = generateInvoiceId(tag, count ?? 0)
    const vendorLabel = extracted.supplier_name ?? vendor ?? from_email?.split('@')[1] ?? 'Unknown Vendor'

    // Auto-set status based on due date
    const effectiveDueDate = extracted.due_date ?? today
    const initialStatus    = effectiveDueDate < today ? 'Overdue' : 'Pending'

    // ── Upload PDF to Supabase Storage ────────────────────────────────────────
    let pdfStorageUrl: string | null = null
    if (pdf_base64) {
        try {
            const pdfBuffer = Buffer.from(pdf_base64, 'base64')
            const fileName  = `${dealership_id}/${invoiceId}.pdf`
            const { error: uploadError } = await db.storage
                .from('purchase-invoices')
                .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })
            if (!uploadError) {
                const { data: urlData } = db.storage.from('purchase-invoices').getPublicUrl(fileName)
                pdfStorageUrl = urlData?.publicUrl ?? null
            } else {
                console.warn('[purchase-invoice] PDF upload failed:', uploadError.message)
            }
        } catch (e) {
            console.warn('[purchase-invoice] PDF upload error:', e)
        }
    }

    const isConsolidated = matchedPoIds.length > 1
    const notes = [
        goods_receipt_id ? `Linked to delivery note ${goods_receipt_id}.` : null,
        poFullyReceived ? 'PO fully received.' : null,
        isConsolidated ? `Consolidated invoice covering ${matchedPoIds.length} POs: ${matchedPoIds.join(', ')}.` : null,
        extracted.lineItems.length > 0 ? `${extracted.lineItems.length} line item(s) detected.` : null,
        'Auto-imported via email.',
    ].filter(Boolean).join(' ')

    const { error } = await db.from('purchase_invoices').insert({
        id:                      invoiceId,
        dealership_id,
        supplier_invoice_number: extracted.supplier_invoice_number,
        po_id,
        po_references:           matchedPoIds.length > 1 ? matchedPoIds : null,
        vendor:                  vendorLabel,
        invoice_date:            extracted.invoice_date ?? today,
        due_date:                extracted.due_date     ?? today,
        amount:                  finalAmount,
        status:                  initialStatus,
        notes,
        pdf_url:                 pdfStorageUrl,
        po_fully_received:       poFullyReceived,
    })

    if (error) {
        console.error('[purchase-invoice] insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Insert line items ─────────────────────────────────────────────────────
    if (extracted.lineItems.length > 0) {
        const { error: itemsError } = await db.from('purchase_invoice_items').insert(
            extracted.lineItems.map((li: AIInvoiceResult['lineItems'][0]) => ({
                invoice_id:       invoiceId,
                dealership_id,
                article_number:   li.article_number,
                description:      li.description,
                qty:              li.qty,
                gross_unit_price: li.gross_unit_price ?? null,
                discount_pct:     li.discount_pct ?? null,
                discount_amount:  li.discount_amount ?? null,
                unit_price:       li.unit_price,
                line_total:       li.line_total,
                vin:              li.vin ?? null,
                po_reference:     li.po_reference ?? null,
            })),
        )
        if (itemsError) {
            console.error('[purchase-invoice] line items insert failed:', itemsError.message, itemsError.details, itemsError.hint)
            console.error('[purchase-invoice] items data:', JSON.stringify(extracted.lineItems.slice(0, 2)))
        } else {
            console.log('[purchase-invoice] line items inserted OK:', extracted.lineItems.length)
        }
    }

    // ── Notify dealer by email ────────────────────────────────────────────────
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    const fromEmail      = process.env.POSTMARK_FROM_EMAIL ?? 'invoice@bikeme.now'

    if (postmarkApiKey) {
        const { data: settings } = await db
            .from('dealership_settings')
            .select('email, invoice_email')
            .eq('dealership_id', dealership_id)
            .maybeSingle()

        const dealerEmail = (settings as Record<string, string> | null)?.invoice_email
            || settings?.email

        if (!dealerEmail) {
            console.warn('[purchase-invoice] no dealer email found for dealership', dealership_id)
        }

        if (dealerEmail) {
            const client = new ServerClient(postmarkApiKey)

            const attachments = pdf_base64
                ? [{
                    Name:        `${invoiceId}.pdf`,
                    Content:     pdf_base64,
                    ContentType: 'application/pdf',
                    ContentID:   '',
                }]
                : []

            await client.sendEmail({
                From:        `BikeMeNow Purchasing <${fromEmail}>`,
                To:          dealerEmail,
                Subject:     `[Invoice Received] ${invoiceId} — ${vendorLabel}${po_id ? ` · ${po_id}` : ''}`,
                Attachments: attachments,
                HtmlBody: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                        <div style="background:#1e3a5f;padding:20px 28px;border-radius:8px 8px 0 0;">
                            <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Purchase Invoice</p>
                            <h2 style="margin:4px 0 0;color:#fff;font-family:monospace;">${invoiceId}</h2>
                        </div>
                        <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                            <p style="color:#374151;">Invoice received from <strong>${vendorLabel}</strong>${po_id ? ` for PO <strong>${po_id}</strong>` : ''}.</p>
                            <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
                                <tr><td style="padding:6px 0;color:#6b7280;">Supplier Invoice #</td><td style="padding:6px 0;font-weight:600;color:#111;">${extracted.supplier_invoice_number ?? '—'}</td></tr>
                                <tr><td style="padding:6px 0;color:#6b7280;">Invoice Date</td><td style="padding:6px 0;color:#111;">${extracted.invoice_date ?? today}</td></tr>
                                <tr><td style="padding:6px 0;color:#6b7280;">Due Date</td><td style="padding:6px 0;font-weight:600;color:#dc2626;">${extracted.due_date ?? today}</td></tr>
                                <tr><td style="padding:6px 0;color:#6b7280;">Amount</td><td style="padding:6px 0;font-weight:700;color:#111;">SEK ${finalAmount.toLocaleString('sv-SE')}</td></tr>
                                ${goods_receipt_id ? `<tr><td style="padding:6px 0;color:#6b7280;">Delivery Note</td><td style="padding:6px 0;font-mono;color:#111;">${goods_receipt_id}</td></tr>` : ''}
                            </table>
                            <p style="color:#6b7280;font-size:12px;margin-top:16px;">Log in to BikeMeNow → Purchase Invoices to review and process payment.</p>
                        </div>
                    </div>`,
                TextBody: [
                    `Invoice Received: ${invoiceId}`,
                    `Vendor: ${vendorLabel}`,
                    po_id              ? `PO: ${po_id}`                                         : '',
                    extracted.supplier_invoice_number ? `Supplier Invoice #: ${extracted.supplier_invoice_number}` : '',
                    `Invoice Date: ${extracted.invoice_date ?? today}`,
                    `Due Date: ${extracted.due_date ?? today}`,
                    `Amount: SEK ${finalAmount.toLocaleString('sv-SE')}`,
                    goods_receipt_id   ? `Delivery Note: ${goods_receipt_id}`                   : '',
                    '',
                    'Log in to BikeMeNow → Purchase Invoices to review.',
                ].filter(Boolean).join('\n'),
            }).catch(e => console.warn('[purchase-invoice] email notify failed:', e))
        } else {
            console.warn('[purchase-invoice] no dealer email found in dealership_settings for', dealership_id)
        }
    }

    return NextResponse.json({
        ok:                      true,
        invoice_id:              invoiceId,
        supplier_invoice_number: extracted.supplier_invoice_number,
        po_id,
        goods_receipt_id,
        po_fully_received:       poFullyReceived,
        due_date:                extracted.due_date,
        amount:                  finalAmount,
        item_count:              extracted.lineItems.length,
        pdf_url:                 pdfStorageUrl,
    })
}
