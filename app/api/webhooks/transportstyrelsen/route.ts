import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/webhooks/transportstyrelsen
 *
 * E-hälsning callback from Transportstyrelsen when an ownership transfer
 * (ägarbyte) changes status — most importantly when COMPLETED.
 *
 * Configure the webhook URL in the Transportstyrelsen API portal.
 * Secure with env var TRANSPORTSTYRELSEN_WEBHOOK_SECRET (HMAC-SHA256 over raw body).
 * Transportstyrelsen sends the signature in the X-Transportstyrelsen-Signature header.
 *
 * Payload:
 * {
 *   caseId:             string
 *   status:             'INITIATED' | 'PENDING_SELLER' | 'PENDING_BUYER' | 'COMPLETED' | 'REJECTED'
 *   registrationNumber: string
 *   completedAt?:       string   // ISO datetime, present when status=COMPLETED
 *   rejectedReason?:    string   // present when status=REJECTED
 * }
 */

interface TransportPayload {
  caseId:            string;
  status:            'INITIATED' | 'PENDING_SELLER' | 'PENDING_BUYER' | 'COMPLETED' | 'REJECTED';
  registrationNumber: string;
  completedAt?:      string;
  rejectedReason?:   string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => getSupabaseAdmin() as any;

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret  = process.env.TRANSPORTSTYRELSEN_WEBHOOK_SECRET;

  // Verify HMAC signature when secret is configured
  if (secret) {
    const sig = req.headers.get('x-transportstyrelsen-signature') ?? '';
    if (!verifySignature(rawBody, sig, secret)) {
      console.warn('[webhook/transportstyrelsen] signature mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: TransportPayload;
  try {
    payload = JSON.parse(rawBody) as TransportPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { caseId, status, registrationNumber, completedAt, rejectedReason } = payload;

  if (!caseId || !status) {
    return NextResponse.json({ error: 'caseId and status required' }, { status: 400 });
  }

  console.log(`[webhook/transportstyrelsen] caseId=${caseId} status=${status} regNr=${registrationNumber}`);

  // Find the lead with this caseId
  const { data: leads, error: findErr } = await sb()
    .from('leads')
    .select('id, dealership_id, name, bike')
    .eq('transfer_case_id', caseId)
    .limit(1);

  if (findErr) {
    console.error('[webhook/transportstyrelsen] lead lookup error:', findErr.message);
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  const lead = leads?.[0] as { id: number; dealership_id: string; name: string; bike: string } | undefined;

  if (lead) {
    // Update transfer status on the lead
    await sb()
      .from('leads')
      .update({ transfer_status: status, transfer_completed_at: completedAt ?? null })
      .eq('id', lead.id)
      .eq('dealership_id', lead.dealership_id);

    if (status === 'COMPLETED') {
      // Log activity on the lead
      await sb()
        .from('lead_activities')
        .insert({
          lead_id:      lead.id,
          dealership_id: lead.dealership_id,
          type:         'note',
          content:      `Ägarbyte slutfört via Transportstyrelsen (ärende ${caseId}). Fordon: ${registrationNumber}${completedAt ? '. Genomfört: ' + new Date(completedAt).toLocaleString('sv-SE') : ''}.`,
          created_by:   'Transportstyrelsen',
        });
    } else if (status === 'REJECTED') {
      await sb()
        .from('lead_activities')
        .insert({
          lead_id:       lead.id,
          dealership_id: lead.dealership_id,
          type:          'note',
          content:       `Ägarbyte avvisat (ärende ${caseId}). Fordon: ${registrationNumber}. Orsak: ${rejectedReason ?? 'okänd'}.`,
          created_by:    'Transportstyrelsen',
        });
    }
  } else {
    console.warn(`[webhook/transportstyrelsen] no lead found for caseId=${caseId}`);
  }

  return NextResponse.json({ received: true });
}
