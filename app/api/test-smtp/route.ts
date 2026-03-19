import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
    const { smtpUser, smtpPass, smtpHost, smtpPort } = await req.json()

    if (!smtpUser || !smtpPass) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    try {
        const isGmail = smtpHost === 'smtp.gmail.com'
        const transporter = nodemailer.createTransport(
            isGmail
                ? { service: 'gmail', auth: { user: smtpUser, pass: smtpPass } }
                : { host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass } }
        )

        await transporter.verify()

        await transporter.sendMail({
            from:    smtpUser,
            to:      smtpUser,
            subject: 'AVA-MC Email Test ✓',
            text:    'Your email settings are configured correctly. Purchase Order emails will be sent from this address.',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
                    <div style="background:#1e3a5f;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
                        <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">AVA-MC System</p>
                        <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px;">Email Test Successful ✓</h2>
                    </div>
                    <p style="color:#374151;font-size:14px;line-height:1.6;">
                        Your SMTP settings are configured correctly.<br/>
                        Purchase Order emails will be sent from <strong>${smtpUser}</strong>.
                    </p>
                    <p style="color:#9ca3af;font-size:12px;margin-top:20px;">This is an automated test message from AVA-MC.</p>
                </div>
            `,
        })

        return NextResponse.json({ ok: true })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
