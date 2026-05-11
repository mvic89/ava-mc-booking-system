import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

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
    From:               string
    To:                 string
    Subject:            string
    TextBody:           string
    HtmlBody:           string
    StrippedTextReply?: string
    // Postmark sets MailboxHash to the token after '+' in plus-addressed emails
    // e.g. reply+abc123@domain → MailboxHash = "abc123"
    MailboxHash?:       string
    // The exact inbound address that received the email (most reliable for routing)
    OriginalRecipient?: string
    Attachments:        PostmarkAttachment[]
}

export async function POST(req: NextRequest) {
    // Postmark inbound does not send auth headers.
    // Secure via secret query param: /api/webhooks/inbound?secret=xxx
    const secret = req.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.POSTMARK_INBOUND_TOKEN

    if (expectedSecret && secret !== expectedSecret) {
        console.warn(`[inbound] Unauthorized: secret mismatch. Expected "${expectedSecret}", got "${secret}"`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let payload: PostmarkInboundPayload
    try {
        payload = await req.json()
    } catch (e) {
        console.error('[inbound] Failed to parse Postmark payload:', e)
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { From, To, Subject, TextBody, Attachments = [] } = payload
    const toAddress          = To?.toLowerCase() ?? ''
    const originalRecipient  = (payload.OriginalRecipient ?? '').toLowerCase()
    const mailboxHash        = payload.MailboxHash ?? ''
    console.log(`[inbound] Received: from=${From} | to=${To} | original=${payload.OriginalRecipient ?? ''} | hash=${mailboxHash} | subject=${Subject}`)

    const db = getSupabaseAdmin()

    // ── Extract PO reference early — needed for dealership resolution ─────────
    // Priority: Subject → TextBody → PDF attachment (fresh emails with no text body)
    const PO_BODY_RE = /(?:er\s*referens|ordernummer|order\s*nr|po\s*(?:no|#|number)?|purchase\s*order)[:\s#]*([A-Z0-9][A-Z0-9\-\/]*)/i

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

    // ── Extract email addresses ───────────────────────────────────────────────
    const toEmail    = toAddress.match(/<(.+?)>/)?.[1] ?? toAddress.split(',')[0]?.trim() ?? toAddress
    const plusMatch  = toEmail.match(/\+([^@\s>]+)@/)
    const senderEmail  = From.match(/<(.+?)>/)?.[1] ?? From.trim()
    const senderDomain = senderEmail.split('@')[1]?.toLowerCase()

    // ── Customer reply — detect and parse FIRST before anything else ──────────
    // reply+{dealershipId}@domain             (legacy, no lead ID)
    // reply+{dealershipId}_l_{leadId}@domain  (current format)
    //
    // Detection priority:
    //   1. OriginalRecipient starts with reply+  (most reliable — exact inbound address)
    //   2. MailboxHash present + To/OriginalRecipient contains reply  (Postmark hash field)
    //   3. toEmail parsed from To header starts with reply+            (fallback)
    const isCustomerReply =
        originalRecipient.startsWith('reply+') ||
        (mailboxHash !== '' && (originalRecipient.includes('reply') || toAddress.includes('reply+'))) ||
        toEmail.startsWith('reply+') ||
        toAddress.includes('reply+')

    let replyLeadId: string | null = null
    let resolvedDealershipId: string | null = null

    if (isCustomerReply) {
        // MailboxHash is the cleanest source — Postmark strips the 'reply+' prefix
        // so it contains only the token. Fall back to plus-match parsing from To header.
        const token = mailboxHash || plusMatch?.[1] || null
        if (token) {
            const sep = token.indexOf('_l_')
            if (sep !== -1) {
                resolvedDealershipId = token.substring(0, sep)
                replyLeadId          = token.substring(sep + 3)
            } else {
                resolvedDealershipId = token
            }
        }
        console.log(`[inbound] Customer reply detected — dealer: ${resolvedDealershipId ?? 'unknown'} lead: ${replyLeadId ?? 'unknown'} (hash=${mailboxHash || 'none'})`)
    } else {
        // Non-reply — initialise from plus-address (may be corrected below)
        resolvedDealershipId = plusMatch?.[1] ?? null
        if (resolvedDealershipId) {
            console.log(`[inbound] Dealership resolved from plus-address: ${resolvedDealershipId}`)
        }
    }

    // ── Dealership resolution for non-reply emails (most → least reliable) ────
    if (!isCustomerReply) {
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
            console.log(`[inbound] Resolved dealership from vendor email lookup: ${resolvedDealershipId}`)
        }

        // 4. Last resort — only safe for single-tenant setups
        if (!resolvedDealershipId) {
            const { data: singleDealer } = await db
                .from('dealerships').select('id').limit(1).maybeSingle()
            if (singleDealer) {
                resolvedDealershipId = singleDealer.id
                console.warn(`[inbound] No dealership matched for From:${From} PO:${poRefEarly ?? 'none'} — falling back to first dealership.`)
            }
        }
    }

    // ── Route by To address ───────────────────────────────────────────────────
    const inboundDomain  = process.env.POSTMARK_INBOUND_DOMAIN ?? ''
    const inboundAddress = process.env.POSTMARK_INBOUND_ADDRESS ?? ''

    // Explicitly exclude reply+ addresses from delivery / invoice detection
    const isDeliveryInbox = !isCustomerReply && (
        toAddress.includes('delivery')
        || toAddress.includes('följesedel')
        || toAddress.includes('inbound.postmarkapp.com')
        || (inboundAddress && toAddress.includes(inboundAddress.split('@')[0]))
    )

    // inboundDomain match is intentionally removed — it caught all reply+ addresses
    const isInvoiceInbox = !isCustomerReply && (
        toAddress.includes('invoice')
        || toAddress.includes('faktura')
    )

    // Extract dealership from invoice plus-address: invoice+{uuid}@...
    if (!resolvedDealershipId && isInvoiceInbox) {
        const invoicePlusMatch = toAddress.match(/invoice\+([a-f0-9\-]{36})@/)
        if (invoicePlusMatch) resolvedDealershipId = invoicePlusMatch[1]
    }

    // Declare vendor so delivery/invoice handlers can reference it
    let vendor: { dealership_id: string; name: string } | null = null
    if (!isCustomerReply) {
        const { data: ve } = await db.from('vendors').select('dealership_id, name')
            .ilike('email', senderEmail).maybeSingle()
        const { data: vd } = !ve
            ? await db.from('vendors').select('dealership_id, name')
                .ilike('email', `%@${senderDomain}`).maybeSingle()
            : { data: null }
        vendor = ve ?? vd
    }

    console.log(`[inbound] To: "${toEmail}" | isCustomerReply: ${isCustomerReply} | isDelivery: ${isDeliveryInbox} | isInvoice: ${isInvoiceInbox} | dealer: ${resolvedDealershipId ?? 'unknown'}`)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'http://localhost:3000');

    if (isDeliveryInbox) {
        console.log(`[inbound] → routing to delivery/goods-receipt`)
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

        // ── Safety check: vendor replied to PO thread with an invoice ─────────
        // Detect by subject or PDF filename containing invoice/faktura keywords
        const INVOICE_RE = /\b(invoice|faktura|rechnung|facture|fattura)\b/i
        const looksLikeInvoice =
            INVOICE_RE.test(Subject ?? '') ||
            (pdfAttachment && INVOICE_RE.test(pdfAttachment.Name))

        if (looksLikeInvoice) {
            console.log(`[inbound] Delivery reply looks like an invoice — re-routing. Subject: "${Subject}", File: "${pdfAttachment?.Name ?? ''}"`)
            const invRes = await fetch(`${baseUrl}/api/purchase-invoice/process`, {
                method:  'POST',
                headers: {
                    'Content-Type':     'application/json',
                    'x-webhook-secret': process.env.GOODS_RECEIPT_WEBHOOK_SECRET ?? '',
                },
                body: JSON.stringify({
                    dealership_id: resolvedDealershipId,
                    vendor:        vendor?.name ?? senderDomain,
                    from_email:    senderEmail,
                    pdf_base64:    pdfAttachment?.Content ?? undefined,
                }),
            })
            const result = await invRes.json()
            return NextResponse.json({ ok: true, routed_to: 'purchase-invoice (re-routed from delivery)', ...result })
        }

        // Use the PO ref extracted earlier (already normalised)
        const po_id = poRefEarly ?? undefined

        // Forward to goods-receipt handler
        // Use localhost for internal calls in dev to avoid SSL tunnel issues
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

        const result = await grRes.json().catch(() => ({}))
        if (!grRes.ok) {
            console.error('[inbound] goods-receipt failed:', grRes.status, result)
            return NextResponse.json({ error: 'Goods receipt processing failed', detail: result }, { status: 500 })
        }

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

        await fetch(`${baseUrl}/api/notifications/add`, {
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

        return NextResponse.json({ ok: true, routed_to: 'goods-receipt', ...result })
    }

    if (isInvoiceInbox) {
        console.log(`[inbound] → routing to invoice inbox for dealership ${resolvedDealershipId}`)
        if (!resolvedDealershipId) {
            console.warn(`[inbound] Cannot resolve dealership for invoice — From: ${From}`)
            return NextResponse.json({ error: 'Dealer not identified' }, { status: 422 })
        }

        const pdfAttachment = Attachments.find(a =>
            a.ContentType === 'application/pdf' || a.Name.toLowerCase().endsWith('.pdf'),
        )

        let result: Record<string, unknown> = {}
        try {
            const invRes = await fetch(`${baseUrl}/api/purchase-invoice/process`, {
                method:  'POST',
                headers: {
                    'Content-Type':     'application/json',
                    'x-webhook-secret': process.env.GOODS_RECEIPT_WEBHOOK_SECRET ?? '',
                },
                body: JSON.stringify({
                    dealership_id: resolvedDealershipId,
                    vendor:        vendor?.name ?? senderDomain,
                    from_email:    senderEmail,
                    pdf_base64:    pdfAttachment?.Content ?? undefined,
                }),
            })
            result = await invRes.json().catch(() => ({}))
            if (!invRes.ok) {
                console.error('[inbound] purchase-invoice/process failed:', invRes.status, result)
                return NextResponse.json({ error: 'Invoice processing failed', detail: result }, { status: 500 })
            }
        } catch (e) {
            console.error('[inbound] invoice fetch error:', e)
            return NextResponse.json({ error: 'Invoice processing error', detail: String(e) }, { status: 500 })
        }

        // Push in-app notification
        await fetch(`${baseUrl}/api/notifications/add`, {
            method:  'POST',
            headers: {
                'Content-Type':     'application/json',
                'x-webhook-secret': process.env.GOODS_RECEIPT_WEBHOOK_SECRET ?? '',
            },
            body: JSON.stringify({
                dealership_id: resolvedDealershipId,
                type:    'system',
                title:   `🧾 Invoice received — ${vendor?.name ?? senderDomain}`,
                message: `${result.invoice_id} · ${result.po_id ? `PO: ${result.po_id} · ` : ''}Amount: ${result.amount ?? '—'} · Due: ${result.due_date ?? '—'}. Review in Purchase Invoices.`,
                href:    '/purchaseinvoice',
            }),
        }).catch((e) => console.warn('[inbound] invoice notify failed:', e))

        return NextResponse.json({ ok: true, routed_to: 'purchase-invoice', ...result })
    }

    // ── Customer reply ────────────────────────────────────────────────────────
    if (isCustomerReply) {
        if (!resolvedDealershipId) {
            console.warn(`[inbound] Customer reply — no dealership resolved. From: ${From}`)
            return NextResponse.json({ error: 'Dealer not identified' }, { status: 422 })
        }

        // Prefer the stripped reply text (Postmark strips quoted history)
        const replyBody = payload.StrippedTextReply?.trim() || TextBody?.trim() || ''

        // Look up lead name (and resolve lead ID if missing) for the notification
        let leadName: string | null = null
        if (replyLeadId) {
            const { data: lead } = await db
                .from('leads')
                .select('name')
                .eq('id', Number(replyLeadId))
                .maybeSingle()
            leadName = lead?.name ?? null
        } else {
            // Legacy format — try to find the lead via a recent outbound email to this address
            const { data: prev } = await db
                .from('communications')
                .select('lead_id, recipient_name')
                .eq('dealership_id', resolvedDealershipId)
                .eq('direction', 'outbound')
                .ilike('recipient_email', senderEmail)
                .not('lead_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (prev?.lead_id) {
                replyLeadId = String(prev.lead_id)
                leadName    = prev.recipient_name ?? null
                console.log(`[inbound] Resolved lead ${replyLeadId} from outbound history for ${senderEmail}`)
            }
        }

        // Store in communications table as inbound
        const { data: comm, error: commErr } = await db
            .from('communications')
            .insert({
                dealership_id:   resolvedDealershipId,
                lead_id:         replyLeadId ? Number(replyLeadId) : null,
                channel:         'email',
                direction:       'inbound',
                subject:         Subject || null,
                body:            replyBody,
                status:          'received',
                recipient_email: senderEmail,
                recipient_name:  leadName ?? From,
                sent_by:         senderEmail,
            })
            .select('id')
            .single()

        if (commErr) {
            console.error('[inbound] Failed to store customer reply:', commErr)
            return NextResponse.json({ error: 'Failed to store reply', detail: commErr.message }, { status: 500 })
        }

        const preview    = replyBody.length > 120 ? replyBody.slice(0, 120) + '…' : replyBody
        const notifTitle = `💬 Customer reply — ${leadName ?? senderEmail}`
        const href       = replyLeadId ? `/sales/leads/${replyLeadId}` : '/sales/leads'

        await fetch(`${baseUrl}/api/notifications/add`, {
            method:  'POST',
            headers: {
                'Content-Type':     'application/json',
                'x-webhook-secret': process.env.GOODS_RECEIPT_WEBHOOK_SECRET ?? '',
            },
            body: JSON.stringify({
                dealership_id: resolvedDealershipId,
                type:    'lead',
                title:   notifTitle,
                message: preview,
                href,
            }),
        }).catch(e => console.warn('[inbound] customer reply notify failed:', e))

        console.log(`[inbound] Customer reply stored: id=${comm?.id} lead=${replyLeadId ?? 'unknown'} from=${senderEmail}`)
        return NextResponse.json({ ok: true, routed_to: 'customer-reply', comm_id: comm?.id })
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
