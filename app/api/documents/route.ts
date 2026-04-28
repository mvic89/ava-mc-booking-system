// GET  /api/documents?leadId=X  or  ?customerId=X  — list docs + signed URLs
// DELETE /api/documents?id=X                       — delete doc + storage file

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const leadId       = searchParams.get('leadId');
    const customerId   = searchParams.get('customerId');
    const dealershipId = req.headers.get('x-dealership-id');

    if (!dealershipId) {
      return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });
    }

    const sb = getSupabaseAdmin();
    let query = sb
      .from('documents')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false });

    if (leadId)     query = query.eq('lead_id',     parseInt(leadId,     10));
    if (customerId) query = query.eq('customer_id', parseInt(customerId, 10));

    const { data, error } = await query;
    if (error) {
      console.error('[documents] query error:', error.message, error.code, error.details);
      // Table doesn't exist yet — return empty list gracefully
      if (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache')
      ) {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed download URLs in parallel
    const docs = await Promise.all((data ?? []).map(async (row: any) => {
      let url: string | undefined;
      try {
        const { data: signed } = await sb.storage
          .from('documents')
          .createSignedUrl(row.file_path, SIGNED_URL_TTL);
        url = signed?.signedUrl;
      } catch {
        // non-fatal — doc still listed, just without a download link
      }
      return {
        id:           row.id,
        dealershipId: row.dealership_id,
        leadId:       row.lead_id,
        customerId:   row.customer_id,
        name:         row.name,
        filePath:     row.file_path,
        fileSize:     row.file_size,
        mimeType:     row.mime_type,
        category:     row.category,
        uploadedBy:   row.uploaded_by,
        createdAt:    row.created_at,
        url,
      };
    }));

    return NextResponse.json(docs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[documents] GET error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id           = req.nextUrl.searchParams.get('id');
    const dealershipId = req.headers.get('x-dealership-id');

    if (!id)           return NextResponse.json({ error: 'id required' },             { status: 400 });
    if (!dealershipId) return NextResponse.json({ error: 'Missing x-dealership-id' }, { status: 401 });

    const sb = getSupabaseAdmin();

    // Fetch the row first so we know the storage path
    const { data: row, error: fetchErr } = await sb
      .from('documents')
      .select('file_path, dealership_id')
      .eq('id', id)
      .eq('dealership_id', dealershipId)   // tenant isolation
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from storage
    await sb.storage.from('documents').remove([row.file_path]);

    // Delete DB row
    const { error: delErr } = await sb
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('dealership_id', dealershipId);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
