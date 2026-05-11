// POST /api/webhooks/inbound/test
// Simulates a Postmark inbound customer reply without needing real email infrastructure.
// Usage: POST with { dealershipId, leadId, senderEmail, senderName?, body?, subject? }
// This calls the main inbound webhook internally with a synthetic Postmark payload.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Test endpoint disabled in production' }, { status: 403 })
    }

    const body = await req.json() as {
        dealershipId: string
        leadId:       number | string
        senderEmail:  string
        senderName?:  string
        subject?:     string
        body?:        string
    }

    if (!body.dealershipId || !body.leadId || !body.senderEmail) {
        return NextResponse.json({ error: 'Missing dealershipId, leadId, or senderEmail' }, { status: 400 })
    }

    const REPLY_DOMAIN = process.env.POSTMARK_INBOUND_DOMAIN ?? 'inbound.bikeme.now'
    const inboundAddress = `reply+${body.dealershipId}_l_${body.leadId}@${REPLY_DOMAIN}`

    // Build a synthetic Postmark inbound payload
    const syntheticPayload = {
        From:               `"${body.senderName ?? body.senderEmail}" <${body.senderEmail}>`,
        To:                 inboundAddress,
        OriginalRecipient:  inboundAddress,
        MailboxHash:        `${body.dealershipId}_l_${body.leadId}`,
        Subject:            body.subject ?? 'Re: Message from dealer',
        TextBody:           body.body    ?? 'Test reply from customer.',
        HtmlBody:           `<p>${body.body ?? 'Test reply from customer.'}</p>`,
        StrippedTextReply:  body.body    ?? 'Test reply from customer.',
        Attachments:        [],
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'http://localhost:3000')

    const res = await fetch(`${baseUrl}/api/webhooks/inbound`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(syntheticPayload),
    })

    const result = await res.json().catch(() => ({}))
    return NextResponse.json({ simulated: true, webhook_status: res.status, ...result })
}
