// POST /api/nps/respond/[token]
// Public endpoint — no auth required. Records the NPS score and comment.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data, error } = await sb()
    .from('nps_surveys')
    .select('id, recipient_name, score, responded_at, expires_at')
    .eq('token', token)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  return NextResponse.json({ survey: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json() as { score: number; comment?: string };

    if (typeof body.score !== 'number' || body.score < 0 || body.score > 10)
      return NextResponse.json({ error: 'Score must be 0–10' }, { status: 400 });

    // Verify token and check not already responded / expired
    const { data: existing, error: fetchErr } = await sb()
      .from('nps_surveys')
      .select('id, responded_at, expires_at, customer_id')
      .eq('token', token)
      .single();

    if (fetchErr || !existing)
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    if (existing.responded_at)
      return NextResponse.json({ error: 'Already responded' }, { status: 409 });
    if (new Date(existing.expires_at) < new Date())
      return NextResponse.json({ error: 'Survey expired' }, { status: 410 });

    // Save response
    const { data: updated, error: updateErr } = await sb()
      .from('nps_surveys')
      .update({ score: body.score, comment: body.comment ?? null, responded_at: new Date().toISOString() })
      .eq('token', token)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Optionally update customer nps_score (rolling avg handled in analytics page)
    if (existing.customer_id) {
      await sb()
        .from('customers')
        .update({ nps_score: body.score })
        .eq('id', existing.customer_id);
    }

    return NextResponse.json({ survey: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
