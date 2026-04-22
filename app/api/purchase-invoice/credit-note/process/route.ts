import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ServerClient } from 'postmark'
import { extractCreditNoteWithAI } from '@/lib/extractWithAI'

/**
 * POST /api/purchase-invoice/credit-note/process
 *
 * Called by Postmark inbound webhook when a credit note PDF arrives by email.
 * Same pattern as /api/purchase-invoice/process.
 *
 * REQUIRED Supabase SQL (run once in SQL editor):
 * ─────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS purchase_credit_notes (
 *   id                     text PRIMARY KEY,
 *   dealership_id          text NOT NULL,
 *   supplier_credit_number text,
 *   original_invoice_id    text REFERENCES purchase_invoices(id) ON DELETE SET NULL,
 *   vendor                 text NOT NULL,
 *   credit_date            date NOT NULL,
 *   amount                 numeric NOT NULL,
 *   remaining_amount       numeric NOT NULL,
 *   status                 text NOT NULL DEFAULT 'Unmatched',
 *   reason                 text,
 *   pdf_url                text,
 *   notes                  text,
 *   created_at             timestamptz DEFAULT now()
 * );
 *
 * ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS credited_amount numeric DEFAULT 0;
 *
 * CREATE POLICY "Allow all — purchase_credit_notes"
 *   ON purchase_credit_notes FOR ALL TO public USING (true) WITH CHECK (true);
 * ─────────────────────────────────────────────────────
 */

function generateCreditNoteId(tag: string, existing: number): string {
    const year = new Date().getFullYear()
    return `CN-${tag}-${year}-${String(existing + 1).padStart(3, '0')}`
}

export async function POST(req: NextRequest) {
    const body = await req.json()
    const { dealership_id, pdf_base64, from_email, dry_run } = body

    // ── Dry run ───────────────────────────────────────────────────────────────
    if (dry_run === true) {
        try {
            const extracted = await extractCreditNoteWithAI(pdf_base64)
            return NextResponse.json({ dry_run: true, extracted })
        } catch (e) {
            return NextResponse.json({ error: String(e) }, { status: 500 })
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const secret = req.headers.get('x-webhook-secret')
    if (process.env.GOODS_RECEIPT_WEBHOOK_SECRET && secret !== process.env.GOODS_RECEIPT_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!dealership_id || !pdf_base64) {
        return NextResponse.json({ error: 'Missing dealership_id or pdf_base64' }, { status: 400 })
    }

    const db = getSupabaseAdmin()

    // ── Extract credit note data ───────────────────────────────────────────────
    let extracted
    try {
        extracted = await extractCreditNoteWithAI(pdf_base64)
        console.log('[credit-note] AI extracted:', extracted)
    } catch (e) {
        console.error('[credit-note] AI extraction failed:', e)
        return NextResponse.json({ error: 'AI extraction failed' }, { status: 500 })
    }

    // ── Duplicate prevention ──────────────────────────────────────────────────
    if (extracted.supplier_credit_number) {
        const { data: existing } = await db
            .from('purchase_credit_notes')
            .select('id')
            .eq('dealership_id', dealership_id)
            .eq('supplier_credit_number', extracted.supplier_credit_number)
            .maybeSingle()
        if (existing) {
            return NextResponse.json({ ok: true, duplicate: true, existing_id: existing.id })
        }
    }

    // ── Try to match original invoice ─────────────────────────────────────────
    let originalInvoiceId: string | null = null
    let matchedInvoice: Record<string, unknown> | null = null
    let matchStatus = 'Unmatched'

    if (extracted.original_invoice_number) {
        // Try matching by supplier invoice number first
        const { data: bySupplierInv } = await db
            .from('purchase_invoices')
            .select('id, vendor, amount, status, credited_amount')
            .eq('dealership_id', dealership_id)
            .ilike('supplier_invoice_number', `%${extracted.original_invoice_number}%`)
            .maybeSingle()

        if (bySupplierInv) {
            originalInvoiceId = bySupplierInv.id
            matchedInvoice    = bySupplierInv
            matchStatus       = 'Pending'
        } else {
            // Try matching by system invoice ID
            const { data: bySystemId } = await db
                .from('purchase_invoices')
                .select('id, vendor, amount, status, credited_amount')
                .eq('dealership_id', dealership_id)
                .ilike('id', `%${extracted.original_invoice_number}%`)
                .maybeSingle()

            if (bySystemId) {
                originalInvoiceId = bySystemId.id
                matchedInvoice    = bySystemId
                matchStatus       = 'Pending'
            }
        }
    }

    // ── Generate ID ───────────────────────────────────────────────────────────
    const { data: dealer } = await db
        .from('dealerships')
        .select('name')
        .eq('id', dealership_id)
        .single()

    const tag = dealer?.name
        ? dealer.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
        : 'AVA'

    const { count } = await db
        .from('purchase_credit_notes')
        .select('id', { count: 'exact', head: true })
        .eq('dealership_id', dealership_id)

    const creditNoteId = generateCreditNoteId(tag, count ?? 0)
    const today        = new Date().toISOString().split('T')[0]
    const vendorLabel  = extracted.supplier_name ?? from_email?.split('@')[1] ?? 'Unknown Vendor'

    // ── Upload PDF ────────────────────────────────────────────────────────────
    let pdfStorageUrl: string | null = null
    try {
        const pdfBuffer = Buffer.from(pdf_base64, 'base64')
        const fileName  = `${dealership_id}/${creditNoteId}.pdf`
        const { error: uploadError } = await db.storage
            .from('purchase-invoices')
            .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })
        if (!uploadError) {
            const { data: urlData } = db.storage.from('purchase-invoices').getPublicUrl(fileName)
            pdfStorageUrl = urlData?.publicUrl ?? null
        }
    } catch (e) {
        console.warn('[credit-note] PDF upload error:', e)
    }

    // ── Insert credit note ────────────────────────────────────────────────────
    const notes = [
        matchedInvoice ? `Matched to invoice ${originalInvoiceId}.` : 'No matching invoice found — manual matching required.',
        extracted.reason ? `Reason: ${extracted.reason}` : null,
        'Auto-imported via email.',
    ].filter(Boolean).join(' ')

    const { error: insertError } = await db.from('purchase_credit_notes').insert({
        id:                     creditNoteId,
        dealership_id,
        supplier_credit_number: extracted.supplier_credit_number,
        original_invoice_id:    originalInvoiceId,
        vendor:                 vendorLabel,
        credit_date:            extracted.credit_date ?? today,
        amount:                 extracted.amount,
        remaining_amount:       extracted.amount,
        status:                 matchStatus,
        reason:                 extracted.reason,
        pdf_url:                pdfStorageUrl,
        notes,
    })

    if (insertError) {
        console.error('[credit-note] insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // ── Notify dealer ─────────────────────────────────────────────────────────
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    const fromEmail      = process.env.POSTMARK_FROM_EMAIL ?? 'invoice@bikeme.now'

    if (postmarkApiKey) {
        const { data: settings } = await db
            .from('dealership_settings')
            .select('email, invoice_email')
            .eq('dealership_id', dealership_id)
            .maybeSingle()

        const dealerEmail = (settings as Record<string, string> | null)?.invoice_email || settings?.email

        if (dealerEmail) {
            const client = new ServerClient(postmarkApiKey)
            const matchedMsg = matchedInvoice
                ? `Automatically matched to invoice <strong>${originalInvoiceId}</strong>.`
                : `<strong style="color:#dc2626;">No matching invoice found</strong> — please log in and match manually.`

            await client.sendEmail({
                From:    `BikeMeNow Purchasing <${fromEmail}>`,
                To:      dealerEmail,
                Subject: `[Credit Note Received] ${creditNoteId} — ${vendorLabel}`,
                HtmlBody: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                        <div style="background:#4c1d95;padding:20px 28px;border-radius:8px 8px 0 0;">
                            <p style="margin:0;color:#c4b5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Credit Note Received</p>
                            <h2 style="margin:4px 0 0;color:#fff;font-family:monospace;">${creditNoteId}</h2>
                        </div>
                        <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                            <p style="color:#374151;">Credit note received from <strong>${vendorLabel}</strong>. ${matchedMsg}</p>
                            <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
                                <tr><td style="padding:6px 0;color:#6b7280;">Credit Note #</td><td style="padding:6px 0;font-weight:600;color:#111;">${extracted.supplier_credit_number ?? '—'}</td></tr>
                                <tr><td style="padding:6px 0;color:#6b7280;">Original Invoice #</td><td style="padding:6px 0;font-family:monospace;color:#111;">${extracted.original_invoice_number ?? '—'}</td></tr>
                                <tr><td style="padding:6px 0;color:#6b7280;">Credit Date</td><td style="padding:6px 0;color:#111;">${extracted.credit_date ?? today}</td></tr>
                                <tr><td style="padding:6px 0;color:#6b7280;">Credit Amount</td><td style="padding:6px 0;font-weight:700;color:#059669;">− SEK ${extracted.amount.toLocaleString('sv-SE')}</td></tr>
                                ${extracted.reason ? `<tr><td style="padding:6px 0;color:#6b7280;">Reason</td><td style="padding:6px 0;color:#111;">${extracted.reason}</td></tr>` : ''}
                            </table>
                            <p style="color:#6b7280;font-size:12px;margin-top:16px;">Log in to BikeMeNow → Purchase Invoices → Credit Notes to review and apply.</p>
                        </div>
                    </div>`,
                TextBody: [
                    `Credit Note Received: ${creditNoteId}`,
                    `Vendor: ${vendorLabel}`,
                    `Credit Note #: ${extracted.supplier_credit_number ?? '—'}`,
                    `Original Invoice #: ${extracted.original_invoice_number ?? '—'}`,
                    `Credit Amount: − SEK ${extracted.amount.toLocaleString('sv-SE')}`,
                    extracted.reason ? `Reason: ${extracted.reason}` : '',
                    matchedInvoice ? `Matched to: ${originalInvoiceId}` : 'Status: Unmatched — manual matching required',
                    '',
                    'Log in to BikeMeNow → Purchase Invoices → Credit Notes to apply.',
                ].filter(Boolean).join('\n'),
            }).catch(e => console.warn('[credit-note] email notify failed:', e))
        }
    }

    return NextResponse.json({
        ok:                      true,
        credit_note_id:          creditNoteId,
        supplier_credit_number:  extracted.supplier_credit_number,
        original_invoice_id:     originalInvoiceId,
        match_status:            matchStatus,
        amount:                  extracted.amount,
        pdf_url:                 pdfStorageUrl,
    })
}
