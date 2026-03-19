import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
    const {
        toEmail, poId, vendorName, poDate, eta,
        pdfBase64, fromName, replyTo, dealerPhone,
    } = await req.json()

    if (!toEmail || !poId || !pdfBase64) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const resendKey  = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM_EMAIL

    if (!resendKey || !resendFrom) {
        return NextResponse.json(
            { error: 'Email not configured. Add RESEND_API_KEY + RESEND_FROM_EMAIL to .env.local' },
            { status: 500 },
        )
    }

    // pdfBase64 comes in as a data URI: "data:application/pdf;base64,<base64data>"
    const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
    const etaLine    = eta && eta !== '—' ? `Expected Delivery: ${eta}` : ''
    const senderName = fromName || 'Procurement'
    const replyToAddr = replyTo || resendFrom

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
                    <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;">
                      Kindly confirm receipt and advise on stock availability at your earliest convenience.
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
        '',
        senderName,
        'Procurement Department',
        dealerPhone ? `Tel: ${dealerPhone}` : '',
        replyToAddr ? `Email: ${replyToAddr}` : '',
    ].filter(Boolean).join('\n')

    const subject = `[Purchase Order] ${poId} from ${senderName}`

    const resend = new Resend(resendKey)

    const { error } = await resend.emails.send({
        from:        `${senderName} Procurement <${resendFrom}>`,
        to:          [toEmail],
        reply_to:    replyToAddr,
        subject,
        text:        textBody,
        html:        htmlBody,
        attachments: [{ filename: `${poId}.pdf`, content: base64Data }],
    })

    if (error) {
        console.error('Resend error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
