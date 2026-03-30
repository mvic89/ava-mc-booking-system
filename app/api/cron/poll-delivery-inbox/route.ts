import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateReceiptId(tag: string, existing: number): string {
    const year = new Date().getFullYear()
    return `GR-${tag.toUpperCase()}-${year}-${String(existing + 1).padStart(3, '0')}`
}

function normaliseDate(raw: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    const dmy = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    return null
}

// ── Parse delivery note text ──────────────────────────────────────────────────

function parseDeliveryNoteText(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    const vendorLabel = text.match(/(?:from|supplier|vendor|sold by)[:\s]+([^\n]+)/i)
    const vendor = vendorLabel?.[1]?.trim()
        ?? lines.find(l => /[a-zA-Z]{3,}/.test(l) && !/^\d/.test(l))
        ?? null

    const dnMatch  = text.match(/(?:delivery\s*note|packing\s*slip|dn\s*(?:no|#)?)[:\s#]*([A-Z0-9\-\/]+)/i)
    const poMatch  = text.match(/(?:purchase\s*order|po\s*(?:no|#)?|your\s*order)[:\s#]*([A-Z0-9\-\/]+)/i)
    const dateMatch = text.match(/(?:date|delivery\s*date)[:\s]*(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i)

    const delivery_note_number = dnMatch?.[1]?.trim() ?? null
    const po_reference         = poMatch?.[1]?.trim() ?? null
    const received_date        = dateMatch ? normaliseDate(dateMatch[1]) : null

    const items: {
        article_number: string | null
        name: string
        ordered_qty: number | null
        received_qty: number
        unit_cost: number | null
    }[] = []

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

    if (items.length === 0) {
        for (const line of lines) {
            if (/^(item|description|qty|quantity|article|part|price|total)/i.test(line)) continue
            const nums = line.match(/\b(\d{1,5})\b/g)
            if (!nums) continue
            const received = parseInt(nums[nums.length - 1])
            if (isNaN(received) || received <= 0 || received > 9999) continue
            const artMatch  = line.match(/^([A-Z]{1,4}[\d\-]+)\s+/i)
            const nameMatch = line.replace(/^[A-Z]{1,4}[\d\-]+\s+/i, '').match(/^([A-Za-z][^\d]*[A-Za-z])/)
            if (!nameMatch) continue
            items.push({
                article_number: artMatch?.[1] ?? null,
                name:           nameMatch[1].trim(),
                ordered_qty:    nums.length >= 2 ? parseInt(nums[nums.length - 2]) : null,
                received_qty:   received,
                unit_cost:      null,
            })
        }
    }

    const notesMatch = text.match(/(?:notes?|remarks?)[:\s]+([^\n]{10,})/i)

    return { vendor, delivery_note_number, po_reference, received_date, items, notes: notesMatch?.[1]?.trim() ?? null }
}

// ── Match inventory item ──────────────────────────────────────────────────────

async function matchInventoryItem(
    db: ReturnType<typeof getSupabaseAdmin>,
    dealershipId: string,
    articleNumber: string | null,
    name: string,
): Promise<string | null> {
    if (articleNumber) {
        for (const table of ['motorcycles', 'spare_parts', 'accessories'] as const) {
            const { data } = await db.from(table).select('id')
                .eq('dealership_id', dealershipId)
                .eq('article_number', articleNumber)
                .maybeSingle()
            if (data) return data.id
        }
    }
    const nameLower = name.toLowerCase()
    for (const table of ['motorcycles', 'spare_parts', 'accessories'] as const) {
        const { data } = await db.from(table).select('id, name').eq('dealership_id', dealershipId)
        const match = data?.find((r: { id: string; name: string }) =>
            r.name.toLowerCase().includes(nameLower) || nameLower.includes(r.name.toLowerCase())
        )
        if (match) return match.id
    }
    return null
}

// ── Process one delivery note email ──────────────────────────────────────────

async function processDeliveryEmail(
    db: ReturnType<typeof getSupabaseAdmin>,
    dealershipId: string,
    fromEmail: string,
    subject: string,
    rawText: string,
) {
    const parsed = parseDeliveryNoteText(rawText)

    // Extract PO reference from subject if not found in body
    const subjectPoMatch = subject?.match(/PO[-\s][\w\-]+/i)
    const po_id = parsed.po_reference ?? (subjectPoMatch ? subjectPoMatch[0].toUpperCase() : null)

    const { data: dealer } = await db.from('dealerships').select('name').eq('id', dealershipId).single()
    const tag = dealer?.name
        ? dealer.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
        : 'GR'

    // Fetch dealer's contact email from their settings (per-dealership, multi-tenant safe)
    const { data: settings } = await db
        .from('dealership_settings')
        .select('email, name')
        .eq('dealership_id', dealershipId)
        .maybeSingle()
    const dealerEmail = settings?.email ?? process.env.DEALER_NOTIFICATION_EMAIL ?? null
    const dealerName  = settings?.name  ?? dealer?.name ?? 'Dealer'

    const { count } = await db.from('goods_receipts')
        .select('id', { count: 'exact', head: true })
        .eq('dealership_id', dealershipId)

    const receiptId    = generateReceiptId(tag, count ?? 0)
    const receivedDate = parsed.received_date ?? new Date().toISOString().split('T')[0]
    const vendor       = parsed.vendor ?? fromEmail.split('@')[1] ?? 'Unknown Vendor'

    const { error: receiptError } = await db.from('goods_receipts').insert({
        id:                   receiptId,
        dealership_id:        dealershipId,
        po_id,
        vendor,
        delivery_note_number: parsed.delivery_note_number,
        received_date:        receivedDate,
        received_by:          'email_imap',
        notes:                parsed.notes,
        raw_text:             rawText,
        source:               'imap_inbound',
    })

    if (receiptError) throw new Error(receiptError.message)

    const results = []

    for (const item of parsed.items) {
        if (!item.name || item.received_qty <= 0) continue

        const inventoryId = await matchInventoryItem(db, dealershipId, item.article_number, item.name)

        await db.from('goods_receipt_items').insert({
            receipt_id:     receiptId,
            inventory_id:   inventoryId,
            article_number: item.article_number,
            name:           item.name,
            ordered_qty:    item.ordered_qty,
            received_qty:   item.received_qty,
            unit_cost:      item.unit_cost,
            matched:        !!inventoryId,
        })

        if (inventoryId) {
            const table = inventoryId.startsWith('MC-') ? 'motorcycles'
                        : inventoryId.startsWith('SP-') ? 'spare_parts'
                        : 'accessories'

            const { data: current } = await db.from(table).select('stock')
                .eq('id', inventoryId).eq('dealership_id', dealershipId).single()

            if (current) {
                await db.from(table)
                    .update({ stock: (current.stock ?? 0) + item.received_qty })
                    .eq('id', inventoryId).eq('dealership_id', dealershipId)
            }
        }

        results.push({ name: item.name, received_qty: item.received_qty, matched: !!inventoryId })
    }

    return { receiptId, vendor, receivedDate, po_id, items: results, dealerEmail, dealerName }
}

// ── Notify dealer after stock update ─────────────────────────────────────────

async function notifyDealer(result: {
    receiptId:    string
    vendor:       string
    receivedDate: string
    po_id:        string | null
    items:        { name: string; received_qty: number; matched: boolean }[]
    dealerEmail:  string | null
    dealerName:   string
    pdfBase64?:   string   // original delivery note / invoice PDF forwarded to dealer
    pdfName?:     string
}) {
    const dealerEmail  = result.dealerEmail
    const smtpUser     = process.env.GMAIL_SENDER_USER
    const smtpPass     = process.env.GMAIL_SENDER_APP_PASSWORD
    if (!dealerEmail || !smtpUser || !smtpPass) return

    const matched   = result.items.filter(i => i.matched)
    const unmatched = result.items.filter(i => !i.matched)

    const itemRows = result.items.map(i =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${i.name}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">${i.received_qty}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">
            ${i.matched
                ? '<span style="color:#16a34a;font-weight:600;">✓ Updated</span>'
                : '<span style="color:#dc2626;font-weight:600;">⚠ Not matched</span>'}
          </td>
        </tr>`
    ).join('')

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0"
            style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#16a34a;padding:24px 32px;">
                <p style="margin:0;color:#bbf7d0;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Goods Receipt</p>
                <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-family:monospace;">${result.receiptId}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;">
                <p style="margin:0 0 4px;color:#374151;font-size:15px;">
                  Delivery note received from <strong>${result.vendor}</strong>
                  ${result.po_id ? ` for PO <strong style="color:#1e3a5f;">${result.po_id}</strong>` : ''}.
                </p>
                <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Date: ${result.receivedDate}</p>

                <table width="100%" cellpadding="0" cellspacing="0"
                  style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;font-size:13px;">
                  <thead>
                    <tr style="background:#f9fafb;">
                      <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;">Item</th>
                      <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;">Qty</th>
                      <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;">Stock</th>
                    </tr>
                  </thead>
                  <tbody>${itemRows}</tbody>
                </table>

                <div style="display:flex;gap:16px;margin-top:16px;">
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 16px;flex:1;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#16a34a;">${matched.length}</div>
                    <div style="font-size:11px;color:#15803d;">Stock Updated</div>
                  </div>
                  ${unmatched.length > 0 ? `
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 16px;flex:1;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#dc2626;">${unmatched.length}</div>
                    <div style="font-size:11px;color:#b91c1c;">Not in Inventory</div>
                  </div>` : ''}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:11px;">
                  Processed automatically by BikeMeNow for ${result.dealerName}. Log in to review goods receipts.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 587, secure: false,
        auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
        from:    `BikeMeNow Inventory <${smtpUser}>`,
        to:      dealerEmail,
        subject: `[Delivery Received] ${result.receiptId} — ${result.vendor}${result.po_id ? ` · ${result.po_id}` : ''}`,
        html,
        // Forward the original delivery note / invoice PDF so dealer has a copy
        attachments: result.pdfBase64 ? [{
            filename:    result.pdfName ?? 'delivery-note.pdf',
            content:     Buffer.from(result.pdfBase64, 'base64'),
            contentType: 'application/pdf',
        }] : [],
    })
}

// ── Cron handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev && process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId     = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN

    if (!clientId || !clientSecret || !refreshToken) {
        return NextResponse.json(
            { error: 'GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN not set' },
            { status: 500 },
        )
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret)
    auth.setCredentials({ refresh_token: refreshToken })
    const gmail = google.gmail({ version: 'v1', auth })

    const db = getSupabaseAdmin()
    const processed: object[] = []
    const errors:    string[]  = []

    try {
        // Fetch all unread messages in inbox
        const listRes = await gmail.users.messages.list({
            userId: 'me',
            q:      'is:unread in:inbox',
            maxResults: 20,
        })

        const messages = listRes.data.messages ?? []

        for (const msg of messages) {
            try {
                const full = await gmail.users.messages.get({
                    userId: msg.id!,
                    id:     msg.id!,
                    format: 'full',
                })

                const headers    = full.data.payload?.headers ?? []
                const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from')?.value ?? ''
                const subject    = headers.find(h => h.name?.toLowerCase() === 'subject')?.value ?? ''

                // Extract sender email from header like "Name <email@domain.com>"
                const fromEmail = fromHeader.match(/<(.+?)>$/)?.[1] ?? fromHeader.trim()
                const senderDomain = fromEmail.split('@')[1]?.toLowerCase()

                // ── Look up dealership by sender email domain ─────────────────
                const { data: vendor } = await db
                    .from('vendors')
                    .select('dealership_id, name')
                    .ilike('email', `%@${senderDomain}`)
                    .maybeSingle()

                if (!vendor?.dealership_id) {
                    console.warn(`[poll-inbox] Unknown sender domain: ${senderDomain}`)
                    // Mark read so we don't reprocess
                    await gmail.users.messages.modify({
                        userId: 'me', id: msg.id!,
                        requestBody: { removeLabelIds: ['UNREAD'] },
                    })
                    continue
                }

                // ── Extract text: prefer PDF attachment, fall back to body ─────
                let rawText = ''
                const parts  = full.data.payload?.parts ?? []

                const pdfPart = parts.find(p =>
                    p.mimeType === 'application/pdf' ||
                    p.filename?.endsWith('.pdf')
                )

                let pdfBase64: string | undefined
                let pdfName:   string | undefined

                if (pdfPart?.body?.attachmentId) {
                    const att = await gmail.users.messages.attachments.get({
                        userId:       'me',
                        messageId:    msg.id!,
                        id:           pdfPart.body.attachmentId,
                    })
                    // Keep base64 copy to forward to dealer
                    pdfBase64 = Buffer.from(att.data.data ?? '', 'base64url').toString('base64')
                    pdfName   = pdfPart.filename ?? 'delivery-note.pdf'
                    const pdfBuffer = Buffer.from(att.data.data ?? '', 'base64url')
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const mod      = require('pdf-parse')
                    const pdfParse = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text: string }>
                    const parsed    = await pdfParse(pdfBuffer)
                    rawText = parsed.text
                } else {
                    // Fall back to plain text body
                    const textPart = parts.find(p => p.mimeType === 'text/plain')
                        ?? parts.find(p => p.mimeType === 'text/html')
                    const bodyData = textPart?.body?.data ?? full.data.payload?.body?.data ?? ''
                    rawText = Buffer.from(bodyData, 'base64url').toString('utf-8')
                }

                if (!rawText.trim()) {
                    errors.push(`Empty content from ${fromEmail}`)
                    await gmail.users.messages.modify({
                        userId: 'me', id: msg.id!,
                        requestBody: { removeLabelIds: ['UNREAD'] },
                    })
                    continue
                }

                const result = await processDeliveryEmail(
                    db,
                    vendor.dealership_id,
                    fromEmail,
                    subject,
                    rawText,
                )

                processed.push(result)

                // Mark as read
                await gmail.users.messages.modify({
                    userId: 'me', id: msg.id!,
                    requestBody: { removeLabelIds: ['UNREAD'] },
                })

                // Notify dealer with PDF copy — fire-and-forget
                notifyDealer({ ...result, pdfBase64, pdfName }).catch((e) =>
                    console.warn('[poll-inbox] dealer notify failed:', e)
                )

            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                errors.push(message)
                console.error('[poll-inbox] message error:', message)
            }
        }

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[poll-inbox] Gmail API error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }

    return NextResponse.json({
        ok:        true,
        processed: processed.length,
        errors:    errors.length,
        results:   processed,
        ...(errors.length > 0 && { error_details: errors }),
    })
}
