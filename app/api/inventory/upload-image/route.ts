import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData()
        const file         = form.get('file') as File | null
        const dealershipId = form.get('dealershipId') as string | null
        const itemId       = form.get('itemId') as string | null

        if (!file || !dealershipId || !itemId) {
            return NextResponse.json({ error: 'Missing file, dealershipId, or itemId' }, { status: 400 })
        }

        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${dealershipId}/${itemId}/${Date.now()}.${ext}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer      = Buffer.from(arrayBuffer)

        const sb = getSupabaseAdmin()

        // Ensure the bucket exists and is public (safe to call on every upload)
        const { error: createErr } = await sb.storage.createBucket('inventory-images', { public: true })
        if (createErr && !createErr.message.includes('already exists')) {
            // Bucket exists but may be private — force it public
            await sb.storage.updateBucket('inventory-images', { public: true })
        }

        const { error } = await sb.storage
            .from('inventory-images')
            .upload(path, buffer, { contentType: file.type, upsert: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const { data } = sb.storage.from('inventory-images').getPublicUrl(path)
        return NextResponse.json({ url: data.publicUrl })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
