import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-webhook-secret')
    if (process.env.GOODS_RECEIPT_WEBHOOK_SECRET && secret !== process.env.GOODS_RECEIPT_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { dealership_id, type, title, message, href } = await req.json()
    if (!dealership_id || !title || !message) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getSupabaseAdmin()
    const { error } = await db.from('notifications').insert({
        dealership_id, type: type ?? 'system', title, message, href: href ?? null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
