import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ServerClient } from 'postmark'

/**
 * POST /api/purchase-invoice/notify-approval
 * Called from the frontend when an invoice is sent for approval.
 * Sends an email to the dealership's approval email (or fallback to invoice/general email).
 */
export async function POST(req: NextRequest) {
    const { dealership_id, invoice_id, vendor, amount, due_date, supplier_invoice_number } = await req.json()

    if (!dealership_id || !invoice_id) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const postmarkApiKey = process.env.POSTMARK_API_KEY
    const fromEmail      = process.env.POSTMARK_FROM_EMAIL ?? 'invoice@bikeme.now'

    if (!postmarkApiKey) {
        return NextResponse.json({ error: 'POSTMARK_API_KEY not configured' }, { status: 500 })
    }

    const db = getSupabaseAdmin()

    const { data: settings } = await db
        .from('dealership_settings')
        .select('email, invoice_email, approval_email')
        .eq('dealership_id', dealership_id)
        .maybeSingle()

    // approval_email is the dedicated approver address; fall back to invoice_email or general email
    const approverEmail = (settings as Record<string, string> | null)?.approval_email
        || (settings as Record<string, string> | null)?.invoice_email
        || settings?.email

    if (!approverEmail) {
        return NextResponse.json({ error: 'No approver email configured' }, { status: 422 })
    }

    const client     = new ServerClient(postmarkApiKey)
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.bikeme.now'
    const invoiceUrl = `${appUrl}/purchaseinvoice`

    await client.sendEmail({
        From:    `BikeMeNow Purchasing <${fromEmail}>`,
        To:      approverEmail,
        Subject: `[Approval Required] ${invoice_id} — ${vendor}`,
        HtmlBody: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#1e40af;padding:20px 28px;border-radius:8px 8px 0 0;">
                    <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Action Required · Invoice Approval</p>
                    <h2 style="margin:4px 0 0;color:#fff;font-family:monospace;">${invoice_id}</h2>
                </div>
                <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                    <p style="color:#374151;">An invoice from <strong>${vendor}</strong> has been submitted for your approval.</p>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
                        <tr><td style="padding:6px 0;color:#6b7280;">System Ref #</td><td style="padding:6px 0;font-family:monospace;font-weight:600;color:#111;">${invoice_id}</td></tr>
                        ${supplier_invoice_number ? `<tr><td style="padding:6px 0;color:#6b7280;">Supplier Invoice #</td><td style="padding:6px 0;font-family:monospace;color:#111;">${supplier_invoice_number}</td></tr>` : ''}
                        <tr><td style="padding:6px 0;color:#6b7280;">Vendor</td><td style="padding:6px 0;font-weight:600;color:#111;">${vendor}</td></tr>
                        <tr><td style="padding:6px 0;color:#6b7280;">Amount</td><td style="padding:6px 0;font-weight:700;color:#111;">SEK ${Number(amount).toLocaleString('sv-SE')}</td></tr>
                        <tr><td style="padding:6px 0;color:#6b7280;">Due Date</td><td style="padding:6px 0;font-weight:700;color:#dc2626;">${due_date}</td></tr>
                    </table>
                    <a href="${invoiceUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#1e40af;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">
                        Review &amp; Approve →
                    </a>
                    <p style="color:#9ca3af;font-size:11px;margin-top:20px;">Log in to BikeMeNow → Purchase Invoices, open this invoice, and click Approve or Dispute.</p>
                </div>
            </div>`,
        TextBody: [
            'ACTION REQUIRED: Invoice Approval',
            `Invoice ${invoice_id} from ${vendor} needs your approval.`,
            `Amount: SEK ${Number(amount).toLocaleString('sv-SE')}`,
            `Due: ${due_date}`,
            '',
            `Review at: ${invoiceUrl}`,
        ].join('\n'),
    })

    return NextResponse.json({ ok: true, sent_to: approverEmail })
}
