import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ServerClient } from 'postmark'

/**
 * POST /api/purchase-invoice/remind
 *
 * Scans all non-paid invoices and sends reminder emails for:
 *   - Invoices due in exactly 3 days (upcoming reminder)
 *   - Invoices overdue by 1, 7, or 14 days (escalation reminders)
 *
 * Call this from a Vercel Cron Job (vercel.json) or any scheduler:
 *   { "path": "/api/purchase-invoice/remind", "schedule": "0 8 * * *" }
 *
 * Protected by x-webhook-secret header (same secret as goods-receipt webhook).
 */
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-webhook-secret')
    if (process.env.GOODS_RECEIPT_WEBHOOK_SECRET && secret !== process.env.GOODS_RECEIPT_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db             = getSupabaseAdmin()
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    const fromEmail      = process.env.POSTMARK_FROM_EMAIL ?? 'invoice@bikeme.now'

    if (!postmarkApiKey) {
        return NextResponse.json({ error: 'POSTMARK_API_KEY not configured' }, { status: 500 })
    }

    const today    = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Load all unpaid invoices across all dealerships
    const { data: invoices, error } = await db
        .from('purchase_invoices')
        .select('id, dealership_id, vendor, due_date, amount, supplier_invoice_number, status')
        .not('status', 'in', '("Paid","Disputed")')

    if (error || !invoices) {
        return NextResponse.json({ error: error?.message ?? 'No data' }, { status: 500 })
    }

    const client = new ServerClient(postmarkApiKey)
    const sent: string[] = []
    const skipped: string[] = []

    for (const inv of invoices) {
        const dueDate = new Date(inv.due_date)
        dueDate.setHours(0, 0, 0, 0)
        const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000)

        // Only send on specific days: 3 days before, or 1/7/14 days after due
        const isReminderDay = [3, -1, -7, -14].includes(diffDays)
        if (!isReminderDay) { skipped.push(inv.id); continue }

        // Get dealer email
        const { data: settings } = await db
            .from('dealership_settings')
            .select('email, invoice_email')
            .eq('dealership_id', inv.dealership_id)
            .maybeSingle()

        const dealerEmail = (settings as Record<string, string> | null)?.invoice_email || settings?.email
        if (!dealerEmail) { skipped.push(inv.id); continue }

        const isOverdue   = diffDays < 0
        const daysLabel   = isOverdue
            ? `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`
            : `due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`

        const subjectPrefix = isOverdue ? `[ACTION REQUIRED] Invoice Overdue` : `[Reminder] Invoice Due Soon`

        await client.sendEmail({
            From:    `BikeMeNow Purchasing <${fromEmail}>`,
            To:      dealerEmail,
            Subject: `${subjectPrefix} — ${inv.id} · ${inv.vendor}`,
            HtmlBody: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <div style="background:${isOverdue ? '#7f1d1d' : '#1e3a5f'};padding:20px 28px;border-radius:8px 8px 0 0;">
                        <p style="margin:0;color:${isOverdue ? '#fca5a5' : '#93c5fd'};font-size:11px;letter-spacing:2px;text-transform:uppercase;">
                            ${isOverdue ? 'Overdue Invoice' : 'Payment Reminder'}
                        </p>
                        <h2 style="margin:4px 0 0;color:#fff;font-family:monospace;">${inv.id}</h2>
                    </div>
                    <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                        <p style="color:#374151;">Invoice from <strong>${inv.vendor}</strong> is <strong style="color:${isOverdue ? '#dc2626' : '#d97706'}">${daysLabel}</strong>.</p>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
                            <tr><td style="padding:6px 0;color:#6b7280;">System Ref #</td><td style="padding:6px 0;font-weight:600;font-family:monospace;color:#111;">${inv.id}</td></tr>
                            ${inv.supplier_invoice_number ? `<tr><td style="padding:6px 0;color:#6b7280;">Supplier Invoice #</td><td style="padding:6px 0;font-family:monospace;color:#111;">${inv.supplier_invoice_number}</td></tr>` : ''}
                            <tr><td style="padding:6px 0;color:#6b7280;">Due Date</td><td style="padding:6px 0;font-weight:700;color:#dc2626;">${inv.due_date}</td></tr>
                            <tr><td style="padding:6px 0;color:#6b7280;">Amount</td><td style="padding:6px 0;font-weight:700;color:#111;">SEK ${Number(inv.amount).toLocaleString('sv-SE')}</td></tr>
                            <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="padding:6px 0;color:#111;">${inv.status}</td></tr>
                        </table>
                        <p style="color:#6b7280;font-size:12px;margin-top:16px;">Log in to BikeMeNow → Purchase Invoices to review and process payment.</p>
                    </div>
                </div>`,
            TextBody: [
                isOverdue ? 'ACTION REQUIRED: Invoice Overdue' : 'Payment Reminder',
                `Invoice ${inv.id} from ${inv.vendor} is ${daysLabel}.`,
                `Due Date: ${inv.due_date}`,
                `Amount: SEK ${Number(inv.amount).toLocaleString('sv-SE')}`,
                '',
                'Log in to BikeMeNow → Purchase Invoices to process payment.',
            ].join('\n'),
        }).catch(e => console.warn(`[remind] email failed for ${inv.id}:`, e))

        sent.push(inv.id)
        console.log(`[remind] sent ${daysLabel} reminder for ${inv.id} → ${dealerEmail}`)
    }

    return NextResponse.json({
        ok:      true,
        date:    todayStr,
        sent:    sent.length,
        skipped: skipped.length,
        ids:     sent,
    })
}
