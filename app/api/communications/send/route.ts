// POST /api/communications/send
// Sends an email or SMS to a customer and logs it to the communications table.

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabase';

interface DealershipRow {
  name:               string;
  smtp_user:          string | null;
  smtp_pass:          string | null;
  smtp_host:          string | null;
  smtp_port:          number | null;
  admin_email:        string | null;
  email:              string | null;
  twilio_account_sid: string | null;
  twilio_auth_token:  string | null;
  twilio_from_number: string | null;
}

function buildEmailHtml(subject: string, body: string, dealershipName: string): string {
  const escaped = body.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <div style="max-width:540px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#1e2a3f 0%,#FF6B2C 100%);padding:24px 28px;">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;">${dealershipName}</p>
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${subject}</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">${escaped}</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:14px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">${dealershipName} · Skickat via BikeMeNow</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(dealer: DealershipRow, to: string, subject: string, body: string, leadId?: number | null): Promise<void> {
  if (!dealer.smtp_user || !dealer.smtp_pass) throw new Error('SMTP not configured');
  const html    = buildEmailHtml(subject, body, dealer.name);
  const isGmail = (dealer.smtp_host ?? '').includes('gmail');

  // Determine a valid "from" address:
  // - If smtp_user is a real email (contains @), use it directly
  // - Otherwise (e.g. Resend uses user="resend"), fall back to admin_email or dealership email
  const isEmailAddress = (s: string) => s.includes('@');
  const fromEmail =
    isEmailAddress(dealer.smtp_user)
      ? dealer.smtp_user
      : dealer.admin_email ?? dealer.email ?? dealer.smtp_user;

  if (!isEmailAddress(fromEmail ?? '')) {
    throw new Error(
      'Ogiltig avsändaradress. Ange en giltig e-postadress i fältet "Admin Email" i integrationsinställningarna ' +
      '(t.ex. no-reply@contact.bikeme.now).'
    );
  }

  const transport = nodemailer.createTransport(
    isGmail
      ? { service: 'gmail', auth: { user: dealer.smtp_user, pass: dealer.smtp_pass } }
      : {
          host:   dealer.smtp_host ?? 'smtp.resend.com',
          port:   dealer.smtp_port ?? 465,
          secure: (dealer.smtp_port ?? 465) === 465,
          auth:   { user: dealer.smtp_user, pass: dealer.smtp_pass },
        },
  );
  try {
    // Reply-To is the dealership's own email so customer replies go directly to them.
    const replyTo = fromEmail ?? undefined;

    await transport.sendMail({
      from:    `"${dealer.name}" <${fromEmail}>`,
      replyTo,
      to,
      subject,
      html,
      text: body,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('BadCredentials') || msg.includes('535') || msg.includes('Username and Password not accepted')) {
      throw new Error(
        'Gmail nekade inloggningen. Du måste använda ett App-lösenord — inte ditt vanliga Gmail-lösenord. ' +
        'Gå till myaccount.google.com → Säkerhet → Applösenord och generera ett för "BikeMeNow".'
      );
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
      throw new Error(`Kunde inte ansluta till SMTP-servern (${dealer.smtp_host ?? 'smtp.gmail.com'}:${dealer.smtp_port ?? 587}). Kontrollera host och port.`);
    }
    throw new Error(msg);
  }
}

async function sendSms(dealer: DealershipRow, to: string, body: string): Promise<void> {
  const { twilio_account_sid: sid, twilio_auth_token: token, twilio_from_number: from } = dealer;
  if (!sid || !token || !from) throw new Error('Twilio not configured');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      Authorization:   `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Twilio ${res.status}`);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    dealershipId:    string;
    channel:         'email' | 'sms';
    leadId?:         number | null;
    customerId?:     number | null;
    recipientName?:  string;
    recipientEmail?: string;
    recipientPhone?: string;
    subject?:        string;
    message:         string;
    sentBy?:         string;
    templateId?:     string;
  };

  if (!body.dealershipId || !body.channel || !body.message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (body.channel === 'email' && !body.recipientEmail) {
    return NextResponse.json({ error: 'recipientEmail required for email channel' }, { status: 400 });
  }
  if (body.channel === 'sms' && !body.recipientPhone) {
    return NextResponse.json({ error: 'recipientPhone required for sms channel' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data: dealer, error: dErr } = await sb
    .from('dealerships')
    .select('name,smtp_user,smtp_pass,smtp_host,smtp_port,admin_email,email,twilio_account_sid,twilio_auth_token,twilio_from_number')
    .eq('id', body.dealershipId)
    .maybeSingle();

  if (dErr || !dealer) {
    return NextResponse.json({ error: 'Dealership not found' }, { status: 404 });
  }

  const d      = dealer as DealershipRow;
  let   status = 'sent';
  let   errMsg: string | null = null;

  try {
    if (body.channel === 'email') {
      await sendEmail(d, body.recipientEmail!, body.subject ?? `Meddelande från ${d.name}`, body.message, body.leadId);
    } else {
      await sendSms(d, body.recipientPhone!, body.message);
    }
  } catch (err: unknown) {
    status = 'failed';
    errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[communications/send]', body.channel, 'error:', errMsg);
  }

  // Always log, even on failure
  const { data: comm, error: logErr } = await sb
    .from('communications')
    .insert({
      dealership_id:   body.dealershipId,
      lead_id:         body.leadId      ?? null,
      customer_id:     body.customerId  ?? null,
      channel:         body.channel,
      direction:       'outbound',
      subject:         body.subject     ?? null,
      body:            body.message,
      status,
      error_message:   errMsg,
      sent_by:         body.sentBy      ?? null,
      recipient_name:  body.recipientName  ?? null,
      recipient_email: body.recipientEmail ?? null,
      recipient_phone: body.recipientPhone ?? null,
      template_id:     body.templateId  ?? null,
    })
    .select()
    .single();

  if (logErr) console.error('[communications/send] log error:', logErr.message);

  if (status === 'failed') {
    return NextResponse.json({ ok: false, error: errMsg, communication: comm }, { status: 207 });
  }
  return NextResponse.json({ ok: true, communication: comm });
}
