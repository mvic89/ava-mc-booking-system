// ─── Notification channel config ─────────────────────────────────────────────
// GET  /api/notifications/config?dealershipId=…
//      Returns { smtpOk, twilioOk, adminPhone, adminEmail }
//
// POST /api/notifications/config
//      body: { dealershipId, adminPhone? }
//      Saves admin_phone to the dealerships row

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('dealerships')
    .select('smtp_user,smtp_pass,twilio_account_sid,twilio_auth_token,twilio_from_number,admin_phone,admin_email,email')
    .eq('id', dealershipId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });

  const d = data as {
    smtp_user: string | null; smtp_pass: string | null;
    twilio_account_sid: string | null; twilio_auth_token: string | null; twilio_from_number: string | null;
    admin_phone: string | null; admin_email: string | null; email: string | null;
  };

  return NextResponse.json({
    smtpOk:     !!(d.smtp_user && d.smtp_pass),
    twilioOk:   !!(d.twilio_account_sid && d.twilio_auth_token && d.twilio_from_number),
    adminPhone: d.admin_phone ?? null,
    adminEmail: d.admin_email ?? d.email ?? null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    dealershipId?:    string;
    adminPhone?:      string;
    adminEmail?:      string;
    smtpUser?:        string;
    smtpPass?:        string;
    smtpHost?:        string;
    smtpPort?:        number | null;
    twilioAccountSid?: string;
    twilioAuthToken?:  string;
    twilioFromNumber?: string;
  };
  if (!body.dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  // Build update object — only include keys that were explicitly sent
  const updates: Record<string, unknown> = {};
  if ('adminPhone'       in body) updates.admin_phone         = body.adminPhone      ?? null;
  if ('adminEmail'       in body) updates.admin_email         = body.adminEmail      ?? null;
  if ('smtpUser'         in body) updates.smtp_user           = body.smtpUser        ?? null;
  if ('smtpPass'         in body && body.smtpPass) updates.smtp_pass = body.smtpPass;
  if ('smtpHost'         in body) updates.smtp_host           = body.smtpHost        ?? null;
  if ('smtpPort'         in body) updates.smtp_port           = body.smtpPort        ?? null;
  if ('twilioAccountSid' in body) updates.twilio_account_sid  = body.twilioAccountSid ?? null;
  if ('twilioAuthToken'  in body && body.twilioAuthToken) updates.twilio_auth_token = body.twilioAuthToken;
  if ('twilioFromNumber' in body) updates.twilio_from_number  = body.twilioFromNumber ?? null;

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('dealerships')
    .update(updates)
    .eq('id', body.dealershipId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
