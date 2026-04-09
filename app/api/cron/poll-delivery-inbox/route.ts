import { NextResponse } from 'next/server'

/**
 * This cron route is deprecated.
 * Delivery note emails are now received via Postmark Inbound Webhook:
 *   POST /api/webhooks/inbound
 *
 * Configure in Postmark: Settings → Inbound → Webhook URL → /api/webhooks/inbound
 */
export async function GET() {
    return NextResponse.json(
        { message: 'Deprecated — delivery emails are handled by Postmark inbound webhook at /api/webhooks/inbound' },
        { status: 410 },
    )
}
