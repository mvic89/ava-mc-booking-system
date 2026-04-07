import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import * as postmark from 'postmark'

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
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    const fromEmail      = process.env.GMAIL_SENDER_USER ?? 'invoice@bikeme.now'
    if (!postmarkApiKey) return

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

    const client = new postmark.ServerClient(postmarkApiKey)
    await client.sendEmail({
        From:    `BikeMeNow Inventory <${fromEmail}>`,
        To:      dealerEmail,
        Subject: `[Delivery Received] ${receiptId} — ${opts.vendorName}${poId ? ` · ${poId}` : ''}`,
        HtmlBody: `
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
        Attachments: opts.pdfBase64 ? [{
            Name:        opts.pdfName ?? 'delivery-note.pdf',
            Content:     opts.pdfBase64,
            ContentType: 'application/pdf',
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

    // ── Extract PO reference early — needed for dealership resolution ─────────
    // Priority: Subject → TextBody → PDF attachment (fresh emails with no text body)
    const PO_BODY_RE = /(?:er\s*referens|ordernummer|po\s*(?:no|#|number)?|purchase\s*order)[:\s#]*([A-Z0-9][A-Z0-9\-\/]*)/i

    const subjectPoMatch = (Subject ?? '').match(/\bPO[-\s][\w\-]+/i)
    const bodyPoMatch    = (TextBody  ?? '').match(PO_BODY_RE)

    let poRefEarly: string | null =
        subjectPoMatch ? subjectPoMatch[0].replace(/\s/g, '-').toUpperCase()
        : bodyPoMatch  ? bodyPoMatch[1].toUpperCase()
        : null

    // If still not found, try parsing the PDF attachment for a PO reference
    if (!poRefEarly && Attachments.length > 0) {
        const pdfAtt = Attachments.find(a =>
            a.ContentType === 'application/pdf' || a.Name.toLowerCase().endsWith('.pdf')
        )
        if (pdfAtt?.Content) {
            try {
                const pdfParse = require('pdf-parse')
                const pdfBuf  = Buffer.from(pdfAtt.Content, 'base64')
                const parsed  = await pdfParse(pdfBuf)
                const pdfText: string = parsed.text ?? ''
                const pdfPoMatch = pdfText.match(PO_BODY_RE)
                    ?? pdfText.match(/\bPO[-\s][\w\-]+/i)
                if (pdfPoMatch) {
                    poRefEarly = (pdfPoMatch[1] ?? pdfPoMatch[0]).replace(/\s/g, '-').toUpperCase()
                    console.log(`[inbound] PO ref extracted from PDF: ${poRefEarly}`)
                }
            } catch (e) {
                console.warn('[inbound] Early PDF parse failed (non-fatal):', e)
            }
        }
    }

    // ── Dealership resolution (most → least reliable) ────────────────────────
    //
    // 1. Plus-address in To: delivery+{uuid}@inbound.bikeme.now  (most reliable)
    // 2. PO number lookup   — unambiguous when delivery note has a known PO ref
    // 3. Vendor email match — scoped to resolved dealership if already known
    // 4. Single-dealership  — last resort, only safe when there is exactly 1 tenant

    const plusMatch = toAddress.match(/\+([a-f0-9\-]{36})@/)
    let resolvedDealershipId: string | null = plusMatch?.[1] ?? null

    // 2. PO reference → purchase_orders.dealership_id
    if (!resolvedDealershipId && poRefEarly) {
        const { data: poRow } = await db
            .from('purchase_orders')
            .select('dealership_id')
            .ilike('id', `%${poRefEarly}%`)
            .maybeSingle()
        if (poRow?.dealership_id) {
            resolvedDealershipId = poRow.dealership_id
            console.log(`[inbound] Dealership resolved from PO ${poRefEarly} → ${resolvedDealershipId}`)
        }
    }

    // 3. Vendor email lookup — scoped to resolved dealership when known
    const senderEmail  = From.match(/<(.+?)>/)?.[1] ?? From.trim()
    const senderDomain = senderEmail.split('@')[1]?.toLowerCase()

    async function lookupVendor(emailFilter: string) {
        const q = db.from('vendors').select('dealership_id, name').ilike('email', emailFilter)
        return resolvedDealershipId
            ? q.eq('dealership_id', resolvedDealershipId).maybeSingle()
            : q.limit(1).maybeSingle()
    }

    const { data: vendorExact }  = await lookupVendor(senderEmail)
    const { data: vendorDomain } = !vendorExact
        ? await lookupVendor(`%@${senderDomain}`)
        : { data: null }

    const vendor = vendorExact ?? vendorDomain
    if (!resolvedDealershipId && vendor?.dealership_id) {
        resolvedDealershipId = vendor.dealership_id
    }

    // 4. Last resort — only safe for single-tenant setups
    if (!resolvedDealershipId) {
        const { data: singleDealer } = await db
            .from('dealerships').select('id').limit(1).maybeSingle()
        if (singleDealer) {
            resolvedDealershipId = singleDealer.id
            console.warn(`[inbound] No dealership matched for From:${From} PO:${poRefEarly ?? 'none'} — falling back to first dealership. Check vendor email or plus-addressing.`)
        }
    }

    // ── Route by To address ───────────────────────────────────────────────────
    const inboundDomain  = process.env.POSTMARK_INBOUND_DOMAIN ?? ''
    const inboundAddress = process.env.POSTMARK_INBOUND_ADDRESS ?? ''

    const isDeliveryInbox = toAddress.includes('delivery')
        || toAddress.includes('inbound.postmarkapp.com')
        || (inboundAddress && toAddress.includes(inboundAddress.split('@')[0]))

    const isInvoiceInbox = toAddress.includes('invoice')
        && (inboundDomain ? toAddress.includes(inboundDomain) : true)

    if (isDeliveryInbox) {
        const pdfAttachment = Attachments.find(a =>
            a.ContentType === 'application/pdf' ||
            a.Name.toLowerCase().endsWith('.pdf')
        )

        if (!pdfAttachment && !TextBody) {
            return NextResponse.json({ error: 'No PDF attachment or text body found' }, { status: 422 })
        }

        if (!resolvedDealershipId) {
            console.warn(`[inbound] Cannot resolve dealership — To: ${To}, From: ${From}, PO: ${poRefEarly ?? 'none'}`)
            return NextResponse.json({ error: 'Dealer not identified' }, { status: 422 })
        }

        // Use the PO ref extracted earlier (already normalised)
        const po_id = poRefEarly ?? undefined

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
                // Always pass TextBody — used as fallback when PDF is image-based (scanned)
                pdf_text:      TextBody || undefined,
                vendor:        vendor?.name ?? senderDomain,
                po_id,
                received_by:   'postmark_inbound',
            }),
        })

        const result = await grRes.json()

        // ── Push in-app notification to bell ──────────────────────────────────
        const receiptId      = (result.receipt_id             as string)  ?? ''
        const poRef          = (result.po_id                  as string)  ?? ''
        const poMatchStatus  = (result.po_match_status        as string)  ?? 'none'
        const poRefFromNote  = (result.po_reference_from_note as string)  ?? ''
        const poWasPartial   = (result.po_was_partial         as boolean) ?? false
        const willCompletePo = (result.will_complete_po       as boolean) ?? false
        const vendorLabel    = vendor?.name ?? senderDomain

        let notifTitle:   string
        let notifMessage: string

        if (poMatchStatus === 'matched_closed') {
            // PO already fully received — dealer needs to re-link
            notifTitle   = `⚠️ Delivery received — PO already closed`
            notifMessage = `${receiptId} · ${vendorLabel} · ${poRefFromNote} is already fully received. Tap to review and link to an open PO.`

        } else if (poMatchStatus === 'unmatched') {
            // PO ref in delivery note but not found in system
            notifTitle   = `📦 Delivery received — PO not found`
            notifMessage = `${receiptId} · ${vendorLabel} · PO reference "${poRefFromNote}" was not found in the system. Review and link manually.`

        } else if (poWasPartial && willCompletePo) {
            // PO was Partial and this delivery fulfils all remaining backorders
            notifTitle   = `✅ Backorder fulfilled — ${vendorLabel}`
            notifMessage = `${receiptId} · All remaining items for ${poRef} have arrived. Approve to mark PO as fully received.`

        } else if (poWasPartial) {
            // PO was Partial but still has outstanding backorders after this delivery
            notifTitle   = `📦 Partial delivery — ${vendorLabel}`
            notifMessage = `${receiptId} · ${poRef} · Some backorders still outstanding after this delivery. Review in Goods Receipts.`

        } else if (poMatchStatus === 'matched_open' && !willCompletePo) {
            // First delivery for this PO but not everything shipped — PO now Partial
            notifTitle   = `📦 Partial shipment received — ${vendorLabel}`
            notifMessage = `${receiptId} · ${poRef} · Not all ordered items were shipped. PO marked as Partial — backorder pending.`

        } else {
            // Full delivery, fallback match, or no PO
            notifTitle   = `📦 Delivery received — ${vendorLabel}`
            notifMessage = `${receiptId} · ${poRef ? `PO: ${poRef} · ` : ''}Pending your approval — review in Goods Receipts.`
        }

        fetch(`${baseUrl}/api/notifications/add`, {
            method:  'POST',
            headers: {
                'Content-Type':     'application/json',
                'x-webhook-secret': process.env.GOODS_RECEIPT_WEBHOOK_SECRET ?? '',
            },
            body: JSON.stringify({
                dealership_id: resolvedDealershipId,
                type:    'system',
                title:   notifTitle,
                message: notifMessage,
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
