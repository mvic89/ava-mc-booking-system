// ─── Notification channel config ─────────────────────────────────────────────
// GET  /api/notifications/config?dealershipId=…
//      Returns { smtpOk, vonageSmsOk, adminPhone, adminEmail }
//
// POST /api/notifications/config
//      Saves SMTP credentials to the dealerships row.
//      SMS is handled via shared BikeMeNow Vonage account (env vars).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('dealerships')
    .select('smtp_user,smtp_pass,smtp_host,smtp_port,admin_phone,admin_email,email')
    .eq('id', dealershipId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });

  const d = data as {
    smtp_user: string | null; smtp_pass: string | null; smtp_host: string | null; smtp_port: number | null;
    admin_phone: string | null; admin_email: string | null; email: string | null;
  };

  return NextResponse.json({
    smtpOk:      !!(d.smtp_user && d.smtp_pass),
    vonageSmsOk: !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET),
    adminPhone:  d.admin_phone ?? null,
    adminEmail:  d.admin_email ?? d.email ?? null,
    smtpUser:    d.smtp_user  ?? '',
    smtpPass:    d.smtp_pass  ?? '',
    smtpHost:    d.smtp_host  ?? '',
    smtpPort:    d.smtp_port  ?? null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    dealershipId?: string;
    adminPhone?:   string;
    adminEmail?:   string;
    smtpUser?:     string;
    smtpPass?:     string;
    smtpHost?:     string;
    smtpPort?:     number | null;
  };
  if (!body.dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if ('adminPhone' in body) updates.admin_phone = body.adminPhone ?? null;
  if ('adminEmail' in body) updates.admin_email = body.adminEmail ?? null;
  if ('smtpUser'   in body) updates.smtp_user   = body.smtpUser   ?? null;
  if ('smtpPass'   in body && body.smtpPass) updates.smtp_pass = body.smtpPass;
  if ('smtpHost'   in body) updates.smtp_host   = body.smtpHost   ?? null;
  if ('smtpPort'   in body) updates.smtp_port   = body.smtpPort   ?? null;

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('dealerships')
    .update(updates)
    .eq('id', body.dealershipId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
