import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
    const {
        toEmail, poId, vendorName, poDate, eta,
        pdfBase64, fromName, replyTo, dealerPhone, dealershipId,
    } = await req.json()

    if (!toEmail || !poId || !pdfBase64) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const gmailUser = process.env.GMAIL_SENDER_USER
    const gmailPass = process.env.GMAIL_SENDER_APP_PASSWORD

    if (!gmailUser || !gmailPass) {
        return NextResponse.json(
            { error: 'Email not configured. Add GMAIL_SENDER_USER + GMAIL_SENDER_APP_PASSWORD to .env.local' },
            { status: 500 },
        )
    }

    const base64Data  = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
    const etaLine     = eta && eta !== '—' ? `Expected Delivery: ${eta}` : ''
    const senderName  = fromName || 'Procurement'

    // dealerEmail  → BCC on PO so dealer gets a copy in their inbox
    // replyToAddr  → Reply-To so supplier's reply (delivery note) goes to Postmark webhook
    const dealerEmail    = replyTo || gmailUser
    const inboundDomain  = process.env.POSTMARK_INBOUND_DOMAIN
    const inboundAddress = process.env.POSTMARK_INBOUND_ADDRESS
    const replyToAddr = inboundDomain && dealershipId
        ? `delivery+${dealershipId}@${inboundDomain}`
        : inboundAddress ?? dealerEmail

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background:#1e3a5f;padding:28px 32px;">
                    <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Purchase Order</p>
                    <h1 style="margin:4px 0 0;color:#ffffff;font-size:24px;font-family:monospace;">${poId}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 20px;color:#374151;font-size:15px;">Dear <strong>${vendorName}</strong>,</p>
                    <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6;">
                      Please find attached Purchase Order <strong style="color:#1e3a5f;">${poId}</strong>
                      dated <strong>${poDate}</strong>.
                      ${etaLine ? `<br/>Expected Delivery: <strong>${eta}</strong>.` : ''}
                    </p>
                    <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6;">
                      Kindly confirm receipt and advise on stock availability at your earliest convenience.
                    </p>
                    <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;">
                      When dispatching, please send your delivery note PDF to:<br/>
                      <strong style="color:#1e3a5f;">${gmailUser}</strong><br/>
                      <span style="color:#6b7280;font-size:13px;">You can reply to this email or send a new email with the PO number <strong>${poId}</strong> in the subject line.</span>
                    </p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.8;">
                      <strong style="color:#1e3a5f;">${senderName}</strong><br/>
                      Procurement Department<br/>
                      ${dealerPhone ? `Tel: ${dealerPhone}<br/>` : ''}
                      ${replyToAddr ? `Email: ${replyToAddr}` : ''}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#9ca3af;font-size:11px;">
                      This is an automated email sent on behalf of ${senderName}.
                      The purchase order PDF is attached.
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
    `

    const textBody = [
        `Purchase Order: ${poId}`,
        `Date: ${poDate}`,
        etaLine,
        '',
        `Dear ${vendorName},`,
        '',
        `Please find attached Purchase Order ${poId} from ${senderName}.`,
        'Kindly confirm receipt and advise on stock availability at your earliest convenience.',
        `When dispatching, please send your delivery note PDF to: ${gmailUser}`,
        `You can reply to this email or send a new email with ${poId} in the subject line.`,
        '',
        senderName,
        'Procurement Department',
        dealerPhone    ? `Tel: ${dealerPhone}` : '',
        replyToAddr    ? `Email: ${replyToAddr}` : '',
    ].filter(Boolean).join('\n')

    const transporter = nodemailer.createTransport({
        host:   'smtp.gmail.com',
        port:   587,
        secure: false,
        auth: {
            user: gmailUser,
            pass: gmailPass,
        },
    })

    try {
        await transporter.sendMail({
            from:     `${senderName} Procurement <${gmailUser}>`,
            to:       toEmail,
            bcc:      dealerEmail,   // dealer gets silent copy of the PO
            replyTo:  replyToAddr,   // supplier replies → Postmark → auto stock update
            subject:  `[Purchase Order] ${poId} from ${senderName}`,
            text:     textBody,
            html:     htmlBody,
            attachments: [{
                filename:    `${poId}.pdf`,
                content:     Buffer.from(base64Data, 'base64'),
                contentType: 'application/pdf',
            }],
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Gmail SMTP error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
