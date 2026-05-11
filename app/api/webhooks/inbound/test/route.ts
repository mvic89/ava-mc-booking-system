// POST /api/webhooks/inbound/test
// Directly simulates a customer reply without going through Postmark.
// Works both locally and in production for manual testing.
// Usage: POST { dealershipId, leadId, senderEmail, senderName?, body?, subject? }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
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

    const db         = getSupabaseAdmin()
    const leadId     = Number(body.leadId)
    const replyBody  = body.body ?? 'Test reply from customer.'

    // Resolve lead name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead } = await (db as any)
        .from('leads')
        .select('name')
        .eq('id', leadId)
        .maybeSingle()

    const leadName = lead?.name ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comm, error } = await (db as any)
        .from('communications')
        .insert({
            dealership_id:   body.dealershipId,
            lead_id:         leadId,
            channel:         'email',
            direction:       'inbound',
            subject:         body.subject ?? 'Re: Message from dealer',
            body:            replyBody,
            status:          'received',
            recipient_email: body.senderEmail,
            recipient_name:  leadName ?? body.senderName ?? body.senderEmail,
            sent_by:         body.senderEmail,
        })
        .select('id')
        .single()

    if (error) {
        console.error('[inbound/test] DB insert failed:', error)
        return NextResponse.json({ ok: false, error: error.message, hint: error.hint }, { status: 500 })
    }

    return NextResponse.json({
        ok:          true,
        comm_id:     comm?.id,
        lead_name:   leadName,
        routed_to:   'customer-reply (test)',
        note:        'Check Supabase communications table for the new inbound row',
    })
}
