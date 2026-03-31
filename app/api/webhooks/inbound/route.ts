import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import nodemailer from 'nodemailer'

/**
 * Postmark Inbound Email Webhook
 * Configure in Postmark: Settings → Inbound → Webhook URL → /api/webhooks/inbound
 *
 * Routes:
 *   - To: po-delivery@bikeme.now  → processes delivery note PDF → updates inventory
 *   - To: invoice@bikeme.now      → stores invoice for accounts payable (future)
 */

interface PostmarkAttachment {
    Name:          string
    Content:       string   // base64
    ContentType:   string
    ContentLength: number
}

interface PostmarkInboundPayload {
    From:        string
    To:          string
    Subject:     string
    TextBody:    string
    HtmlBody:    string
    Attachments: PostmarkAttachment[]
}

async function notifyDealer(opts: {
    db:            ReturnType<typeof getSupabaseAdmin>
    dealershipId:  string
    vendorName:    string
    receiptResult: Record<string, unknown>
    pdfBase64?:    string
    pdfName?:      string
    subject?:      string
}) {
    const smtpUser = process.env.GMAIL_SENDER_USER
    const smtpPass = process.env.GMAIL_SENDER_APP_PASSWORD
    if (!smtpUser || !smtpPass) return

    // Use delivery_note_email if set, otherwise fall back to general contact email
    const { data: settings } = await opts.db
        .from('dealership_settings')
        .select('email, delivery_note_email')
        .eq('dealership_id', opts.dealershipId)
        .maybeSingle()

    const dealerEmail = settings?.delivery_note_email || settings?.email
    if (!dealerEmail) {
        console.warn(`[notifyDealer] No email in dealership_settings for ${opts.dealershipId} — set Delivery Note Email in Settings`)
        return
    }

    const receiptId = (opts.receiptResult.receipt_id as string) ?? 'GR-NEW'
    const poId      = (opts.receiptResult.po_id      as string) ?? ''

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 587, secure: false,
        auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
        from:    `BikeMeNow Inventory <${smtpUser}>`,
        to:      dealerEmail,
        subject: `[Delivery Received] ${receiptId} — ${opts.vendorName}${poId ? ` · ${poId}` : ''}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#16a34a;padding:20px 28px;border-radius:8px 8px 0 0;">
                    <p style="margin:0;color:#bbf7d0;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Goods Receipt</p>
                    <h2 style="margin:4px 0 0;color:#fff;font-family:monospace;">${receiptId}</h2>
                </div>
                <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                    <p style="color:#374151;">Delivery note received from <strong>${opts.vendorName}</strong>${poId ? ` for PO <strong>${poId}</strong>` : ''}.</p>
                    <p style="color:#6b7280;font-size:13px;">This delivery is pending your approval — stock will not update until you approve it. The original PDF is attached.</p>
                    <p style="color:#6b7280;font-size:12px;margin-top:24px;">Log in to BikeMeNow → Goods Receipts to review and approve.</p>
                </div>
            </div>`,
        attachments: opts.pdfBase64 ? [{
            filename:    opts.pdfName ?? 'delivery-note.pdf',
            content:     Buffer.from(opts.pdfBase64, 'base64'),
            contentType: 'application/pdf',
        }] : [],
    })
}

export async function POST(req: NextRequest) {
    // Postmark inbound does not send auth headers.
    // Secure via secret query param: /api/webhooks/inbound?secret=xxx
    const secret = req.nextUrl.searchParams.get('secret')
    if (process.env.POSTMARK_INBOUND_TOKEN && secret !== process.env.POSTMARK_INBOUND_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let payload: PostmarkInboundPayload
    try {
        payload = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { From, To, Subject, TextBody, Attachments = [] } = payload
    const toAddress = To?.toLowerCase() ?? ''
    const db = getSupabaseAdmin()

    // ── Extract dealershipId from To address ──────────────────────────────────
    // PO emails set Reply-To: delivery+{dealershipId}@inbound.bikeme.now
    const plusMatch = toAddress.match(/\+([a-f0-9\-]{36})@/)
    const dealership_id = plusMatch?.[1] ?? null

    // ── Look up supplier by sender email (exact match first, then domain) ─────
    const senderEmail  = From.match(/<(.+?)>/)?.[1] ?? From.trim()
    const senderDomain = senderEmail.split('@')[1]?.toLowerCase()

    // Try exact email match first
    const { data: vendorExact } = await db
        .from('vendors')
        .select('dealership_id, name')
        .ilike('email', senderEmail)
        .limit(1)
        .maybeSingle()

    // Fall back to domain match — use limit(1) to avoid maybeSingle() failing on multiple rows
    const { data: vendorDomain } = !vendorExact ? await db
        .from('vendors')
        .select('dealership_id, name')
        .ilike('email', `%@${senderDomain}`)
        .limit(1)
        .maybeSingle() : { data: null }

    const vendor = vendorExact ?? vendorDomain

    // Use dealershipId from address (most reliable), fallback to vendor lookup,
    // then fallback to single-dealership setup (only works if there is exactly 1 dealership)
    let resolvedDealershipId = dealership_id ?? vendor?.dealership_id ?? null
    if (!resolvedDealershipId) {
        const { data: singleDealer } = await db
            .from('dealerships')
            .select('id')
            .limit(1)
            .maybeSingle()
        if (singleDealer) {
            resolvedDealershipId = singleDealer.id
            console.log(`[inbound] Sender ${senderEmail} not matched to vendor — falling back to dealership ${resolvedDealershipId}`)
        }
    }

    // ── Route by To address ───────────────────────────────────────────────────
    // delivery@inbound.bikeme.now  → goods receipt + stock update
    // invoice@inbound.bikeme.now   → accounts payable queue
    // hash@inbound.postmarkapp.com → fallback (treated as delivery)
    const inboundDomain  = process.env.POSTMARK_INBOUND_DOMAIN ?? ''
    const inboundAddress = process.env.POSTMARK_INBOUND_ADDRESS ?? ''

    const isDeliveryInbox = toAddress.includes('delivery')
        || toAddress.includes('inbound.postmarkapp.com')
        || (inboundAddress && toAddress.includes(inboundAddress.split('@')[0]))

    const isInvoiceInbox  = toAddress.includes('invoice')
        && (inboundDomain ? toAddress.includes(inboundDomain) : true)

    if (isDeliveryInbox) {
        // Find PDF attachment
        const pdfAttachment = Attachments.find(a =>
            a.ContentType === 'application/pdf' ||
            a.Name.toLowerCase().endsWith('.pdf')
        )

        if (!pdfAttachment && !TextBody) {
            return NextResponse.json({ error: 'No PDF attachment or text body found' }, { status: 422 })
        }

        if (!resolvedDealershipId) {
            console.warn(`[inbound] Cannot resolve dealership — To: ${To}, From: ${From}`)
            return NextResponse.json({ error: 'Dealer not identified' }, { status: 422 })
        }

        // Extract PO reference from subject line e.g. "Delivery Note - PO-2026-001"
        const poMatch = Subject?.match(/PO[-\s][\w\-]+/i)
        const po_id   = poMatch ? poMatch[0].replace(/\s/g, '-').toUpperCase() : undefined

        // Forward to goods-receipt handler
        // Use localhost for internal calls in dev to avoid SSL tunnel issues
        const baseUrl = process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : `https://${req.headers.get('host')}`
        const grRes = await fetch(`${baseUrl}/api/goods-receipt`, {
            method:  'POST',
            headers: {
                'Content-Type':      'application/json',
                'x-webhook-secret':  process.env.GOODS_RECEIPT_WEBHOOK_SECRET ?? '',
            },
            body: JSON.stringify({
                dealership_id: resolvedDealershipId,
                pdf_base64:    pdfAttachment?.Content ?? undefined,
                pdf_text:      pdfAttachment ? undefined : TextBody,
                vendor:        vendor?.name ?? senderDomain,
                po_id,
                received_by:   'postmark_inbound',
            }),
        })

        const result = await grRes.json()

        // ── Push in-app notification to bell ──────────────────────────────────
        const receiptId = (result.receipt_id as string) ?? ''
        const poRef     = (result.po_id     as string) ?? ''
        fetch(`${baseUrl}/api/notifications/add`, {
            method:  'POST',
            headers: {
                'Content-Type':     'application/json',
                'x-webhook-secret': process.env.GOODS_RECEIPT_WEBHOOK_SECRET ?? '',
            },
            body: JSON.stringify({
                dealership_id: resolvedDealershipId,
                type:    'system',
                title:   `📦 Delivery received — ${vendor?.name ?? senderDomain}`,
                message: `${receiptId} · ${poRef ? `PO: ${poRef} · ` : ''}Pending your approval — review in Goods Receipts.`,
                href:    `/goods-receipts?receipt=${receiptId}`,
            }),
        }).catch((e) => console.warn('[inbound] in-app notify failed:', e))

        // ── Notify dealer by email ─────────────────────────────────────────────
        // Fire-and-forget: fetch dealer email from dealership_settings then send
        notifyDealer({
            db,
            dealershipId:  resolvedDealershipId,
            vendorName:    vendor?.name ?? senderDomain ?? 'Supplier',
            receiptResult: result,
            pdfBase64:     pdfAttachment?.Content,
            pdfName:       pdfAttachment?.Name,
            subject:       Subject,
        }).catch((e) => console.warn('[inbound] notify dealer failed:', e))

        return NextResponse.json({ ok: true, routed_to: 'goods-receipt', ...result })
    }

    if (isInvoiceInbox) {
        // Store raw invoice email for accounts payable processing
        await db.from('purchase_invoice_emails').insert({
            dealership_id: resolvedDealershipId,
            from_email:  From,
            subject:     Subject,
            body_text:   TextBody,
            has_pdf:     Attachments.some(a => a.ContentType === 'application/pdf'),
            pdf_content: Attachments.find(a => a.ContentType === 'application/pdf')?.Content ?? null,
            received_at: new Date().toISOString(),
            status:      'pending',
        })

        return NextResponse.json({ ok: true, routed_to: 'invoice-queue' })
    }

    // Unrecognised To address — log and acknowledge
    console.warn(`[inbound] Unrouted email To: ${To}, From: ${From}, Subject: ${Subject}`)
    return NextResponse.json({ ok: true, routed_to: 'unhandled' })
}

// Allow Postmark to POST cross-origin
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-postmark-token',
        },
    })
}
