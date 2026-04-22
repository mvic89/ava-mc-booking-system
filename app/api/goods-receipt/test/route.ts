import { NextRequest, NextResponse } from 'next/server'
import { extractDeliveryNoteWithAI } from '@/lib/extractWithAI'

export async function POST(req: NextRequest) {
    const { pdf_base64 } = await req.json()
    if (!pdf_base64) {
        return NextResponse.json({ error: 'pdf_base64 is required' }, { status: 400 })
    }
    try {
        const extracted = await extractDeliveryNoteWithAI(pdf_base64)
        return NextResponse.json({ extracted })
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 })
    }
}
