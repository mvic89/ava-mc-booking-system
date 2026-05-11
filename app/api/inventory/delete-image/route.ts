import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const { path } = await req.json() as { path?: string }
        if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

        const sb = getSupabaseAdmin()
        const { error } = await sb.storage.from('inventory-images').remove([path])
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ ok: true })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
