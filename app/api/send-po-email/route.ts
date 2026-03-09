import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
    const { toEmail, poId, vendorName, poDate, eta, pdfBase64 } = await req.json()

    if (!toEmail || !poId || !pdfBase64) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const user = process.env.EMAIL_USER
    const pass = process.env.EMAIL_PASS

    if (!user || !pass) {
        return NextResponse.json(
            { error: 'Email credentials not configured. Add EMAIL_USER and EMAIL_PASS to .env.local' },
            { status: 500 },
        )
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    })

    // pdfBase64 comes in as a data URI: "data:application/pdf;base64,<base64data>"
    const base64Data = pdfBase64.split(',')[1]

    const etaLine = eta && eta !== '—' ? `Expected Delivery: ${eta}` : ''

    await transporter.sendMail({
        from: `"AVA Motorcycle Centre Procurement" <${user}>`,
        to: toEmail,
        replyTo: user,
        subject: `[Purchase Order] ${poId} from AVA Motorcycle Centre`,
        // Plain-text version — helps avoid spam filters
        text: [
            `Purchase Order: ${poId}`,
            `Date: ${poDate}`,
            etaLine,
            '',
            `Dear ${vendorName},`,
            '',
            `Please find attached Purchase Order ${poId} from AVA Motorcycle Centre.`,
            `Kindly confirm receipt and advise on stock availability at your earliest convenience.`,
            '',
            etaLine,
            '',
            'AVA Motorcycle Centre',
            'Procurement Department',
            'Tel: +60 3-XXXX XXXX',
        ].filter(Boolean).join('\n'),
        html: `
            <!DOCTYPE html>
            <html>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                      <td style="background:#1e3a5f;padding:28px 32px;">
                        <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Purchase Order</p>
                        <h1 style="margin:4px 0 0;color:#ffffff;font-size:24px;font-family:monospace;">${poId}</h1>
                      </td>
                    </tr>
                    <!-- Body -->
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
                          Please do not hesitate to contact us if you have any questions.
                        </p>
                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.8;">
                          <strong style="color:#1e3a5f;">AVA Motorcycle Centre</strong><br/>
                          Procurement Department<br/>
                          Tel: +60 3-XXXX XXXX
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;">
                        <p style="margin:0;color:#9ca3af;font-size:11px;">
                          This is an automated email from AVA Motorcycle Centre's procurement system.
                          The purchase order PDF is attached to this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
        `,
        attachments: [
            {
                filename: `${poId}.pdf`,
                content: base64Data,
                encoding: 'base64',
                contentType: 'application/pdf',
            },
        ],
        headers: {
            'X-Mailer': 'AVA-MC-System',
            'X-Entity-Ref-ID': poId,
        },
    })

    return NextResponse.json({ ok: true })
}
