// ─── Notification Dispatch — Email + SMS ──────────────────────────────────────
// POST /api/notifications/send
// body: {
//   dealershipId: string
//   channels:     ('email' | 'sms')[]
//   title:        string
//   message:      string
//   href?:        string     — deep link for email CTA
//   eventType?:   string     — human-readable event name for email subject
// }
//
// Email: uses dealership SMTP config (smtp_user/pass/host/port on dealerships row)
// SMS:   uses dealership Twilio config (twilio_account_sid/auth_token/from_number)
//        + admin_phone as the recipient number

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DealershipRow {
  name:                string;
  email:               string | null;
  admin_email:         string | null;
  admin_phone:         string | null;
  smtp_user:           string | null;
  smtp_pass:           string | null;
  smtp_host:           string | null;
  smtp_port:           number | null;
  twilio_account_sid:  string | null;
  twilio_auth_token:   string | null;
  twilio_from_number:  string | null;
}

// ── Email HTML builder ─────────────────────────────────────────────────────────

function buildEmailHtml(title: string, message: string, dealershipName: string, href?: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e2a3f 0%,#235971 100%);padding:24px 28px;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">BikeMeNow · ${dealershipName}</p>
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${title}</h1>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">
      <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">${message}</p>
      ${href ? `
      <a href="${href}" style="display:inline-block;background:#FF6B2C;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;">
        Öppna i BikeMeNow →
      </a>` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:14px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Automatisk notis från BikeMeNow · ${dealershipName}</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Send email ─────────────────────────────────────────────────────────────────

async function sendEmail(
  dealer: DealershipRow,
  title: string,
  message: string,
  href?: string,
  eventType?: string,
): Promise<void> {
  const smtpUser = dealer.smtp_user;
  const smtpPass = dealer.smtp_pass;
  if (!smtpUser || !smtpPass) throw new Error('SMTP not configured');

  const toEmail = dealer.admin_email ?? dealer.email ?? smtpUser;
  const html    = buildEmailHtml(title, message, dealer.name, href);
  const subject = eventType ? `${title} · BikeMeNow` : title;

  const isGmail = (dealer.smtp_host ?? '').includes('gmail');
  const transport = nodemailer.createTransport(
    isGmail
      ? { service: 'gmail', auth: { user: smtpUser, pass: smtpPass } }
      : {
          host:   dealer.smtp_host ?? 'smtp.gmail.com',
          port:   dealer.smtp_port ?? 587,
          secure: (dealer.smtp_port ?? 587) === 465,
          auth:   { user: smtpUser, pass: smtpPass },
        },
  );

  await transport.sendMail({
    from:    `"BikeMeNow" <${smtpUser}>`,
    to:      toEmail,
    subject,
    html,
    text: `${title}\n\n${message}${href ? `\n\n${href}` : ''}`,
  });
}

// ── Send SMS via Twilio ────────────────────────────────────────────────────────

async function sendSms(
  dealer: DealershipRow,
  title: string,
  message: string,
): Promise<void> {
  const { twilio_account_sid: sid, twilio_auth_token: token, twilio_from_number: from, admin_phone: to } = dealer;
  if (!sid || !token || !from || !to) throw new Error('Twilio not configured or admin_phone missing');

  const body = `[${dealer.name}] ${title}: ${message}`;
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Twilio ${res.status}`);
  }
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    dealershipId: string;
    channels:     ('email' | 'sms')[];
    title:        string;
    message:      string;
    href?:        string;
    eventType?:   string;
  };

  const { dealershipId, channels, title, message, href, eventType } = body;
  if (!dealershipId || !channels?.length || !title || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: dealer, error: fetchErr } = await sb
    .from('dealerships')
    .select('name,email,admin_email,admin_phone,smtp_user,smtp_pass,smtp_host,smtp_port,twilio_account_sid,twilio_auth_token,twilio_from_number')
    .eq('id', dealershipId)
    .maybeSingle();

  if (fetchErr || !dealer) {
    return NextResponse.json({ error: fetchErr?.message ?? 'Dealership not found' }, { status: 404 });
  }

  const d = dealer as DealershipRow;
  const results: Record<string, { ok: boolean; error?: string }> = {};

  if (channels.includes('email')) {
    try {
      await sendEmail(d, title, message, href, eventType);
      results.email = { ok: true };
    } catch (err: unknown) {
      results.email = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
      console.error('[notifications/send] email error:', results.email.error);
    }
  }

  if (channels.includes('sms')) {
    try {
      await sendSms(d, title, message);
      results.sms = { ok: true };
    } catch (err: unknown) {
      results.sms = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
      console.error('[notifications/send] sms error:', results.sms.error);
    }
  }

  const allOk = Object.values(results).every(r => r.ok);
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}
