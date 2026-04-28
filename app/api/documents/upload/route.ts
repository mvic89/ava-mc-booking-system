// POST /api/documents/upload
// Accepts multipart/form-data: file, name, category, leadId?, customerId?
// Uploads to Supabase Storage bucket "documents" then inserts a row in the
// documents table. Returns the new Document row.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES  = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file       = form.get('file')       as File   | null;
    const name       = form.get('name')       as string | null;
    const category   = form.get('category')   as string | null;
    const leadId     = form.get('leadId')     as string | null;
    const customerId = form.get('customerId') as string | null;
    const uploadedBy = form.get('uploadedBy') as string | null;

    if (!file)     return NextResponse.json({ error: 'No file provided' },    { status: 400 });
    if (!category) return NextResponse.json({ error: 'Category required' },   { status: 400 });

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 });
    }

    // Validate MIME type
    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json({ error: `File type ${mimeType} not allowed` }, { status: 415 });
    }

    const sb = getSupabaseAdmin();

    // Resolve dealership_id from the Authorization header or a trusted server cookie.
    // For now we read it from the x-dealership-id header that the client sends.
    const dealershipId = req.headers.get('x-dealership-id');
    if (!dealershipId) {
      return NextResponse.json({ error: 'Missing x-dealership-id header' }, { status: 401 });
    }

    // Build storage path: dealershipId / context / sanitised filename
    const context    = leadId ? `leads/${leadId}` : customerId ? `customers/${customerId}` : 'general';
    const ext        = file.name.split('.').pop() ?? 'bin';
    const safeName   = (name ?? file.name).replace(/[^a-zA-Z0-9._\-åäöÅÄÖ ]/g, '_').slice(0, 120);
    const storagePath = `${dealershipId}/${context}/${Date.now()}_${safeName}`;

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await sb.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[documents/upload] storage error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Insert metadata row
    const { data, error: dbError } = await sb
      .from('documents')
      .insert({
        dealership_id: dealershipId,
        lead_id:       leadId     ? parseInt(leadId,     10) : null,
        customer_id:   customerId ? parseInt(customerId, 10) : null,
        name:          name ?? file.name,
        file_path:     storagePath,
        file_size:     file.size,
        mime_type:     mimeType,
        category:      category,
        uploaded_by:   uploadedBy ?? '',
      })
      .select()
      .single();

    if (dbError) {
      // Try to clean up the orphaned storage file
      await sb.storage.from('documents').remove([storagePath]);
      console.error('[documents/upload] db error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      id:           data.id,
      dealershipId: data.dealership_id,
      leadId:       data.lead_id,
      customerId:   data.customer_id,
      name:         data.name,
      filePath:     data.file_path,
      fileSize:     data.file_size,
      mimeType:     data.mime_type,
      category:     data.category,
      uploadedBy:   data.uploaded_by,
      createdAt:    data.created_at,
    }, { status: 201 });

  } catch (err: any) {
    console.error('[documents/upload]', err);
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 });
  }
}
