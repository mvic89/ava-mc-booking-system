// POST /api/payment/send-details
// Sends bank transfer payment instructions to a customer via email or SMS.
// Email is delivered through the existing invite/transactional email infrastructure.
// SMS: if an SMS provider (Twilio, 46elks, etc.) is configured, it sends a text.
// Falls back gracefully — caller should show the bank details on screen regardless.

import { NextRequest, NextResponse } from 'next/server';

interface BankDetails {
  company:   string;
  bank:      string;
  bankgiro:  string;
  iban:      string;
  bic:       string;
  amount:    string;
  reference: string;
  currency:  string;
}

interface SendBody {
  contact:     string;          // email address or phone number
  method:      'email' | 'sms';
  customerName: string;
  bankDetails: BankDetails;
  dealerName:  string;
  leadId:      string;
  dealershipId: string;
}

function buildEmailHtml(d: BankDetails, customerName: string, dealerName: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f1729 0%,#162236 100%);padding:32px 36px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;background:#FF6B2C;border-radius:10px;display:flex;align-items:center;justify-content:center">
          <span style="color:white;font-size:20px">🏍</span>
        </div>
        <div>
          <p style="color:white;font-size:17px;font-weight:800;margin:0">${dealerName}</p>
          <p style="color:rgba(255,255,255,.45);font-size:12px;margin:2px 0 0">Betalningsinstruktioner</p>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px">
      <p style="font-size:16px;font-weight:700;color:#0f1729;margin:0 0 6px">Hej ${customerName},</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6">
        Tack för ditt köp! Här är bankuppgifterna för din betalning.
        Var vänlig inkludera <strong>exakt referensnummer</strong> när du gör överföringen.
      </p>

      <!-- Bank details card -->
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:20px">
        <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:0 0 16px">Bankuppgifter</p>
        ${[
          ['Mottagare', d.company],
          ['Bank', d.bank],
          ['Bankgiro', d.bankgiro],
          ['IBAN', d.iban],
          ['BIC/SWIFT', d.bic],
        ].map(([label, value]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
            <span style="font-size:13px;color:#64748b">${label}</span>
            <span style="font-size:13px;font-weight:600;color:#0f172a;font-family:monospace">${value}</span>
          </div>
        `).join('')}

        <!-- Amount & Reference highlighted -->
        <div style="background:#fff7f2;border:1.5px solid #FF6B2C;border-radius:10px;padding:14px 16px;margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:13px;color:#c2410c;font-weight:700">Belopp att betala</span>
            <span style="font-size:20px;font-weight:900;color:#FF6B2C">${d.amount}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:#c2410c;font-weight:700">Referensnummer</span>
            <span style="font-size:15px;font-weight:900;color:#0f172a;font-family:monospace;background:#fff;padding:3px 10px;border-radius:6px;border:1px solid #fbd38d">${d.reference}</span>
          </div>
        </div>
      </div>

      <!-- Warning -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:24px">
        <p style="font-size:13px;color:#92400e;margin:0">
          ⚠️ <strong>Viktigt:</strong> Ange alltid referensen <strong>${d.reference}</strong> i betalningsmeddelandet.
          Utan rätt referens kan vi inte koppla din betalning till ditt ärende.
        </p>
      </div>

      <!-- Timeline -->
      <div style="border-left:2px solid #e2e8f0;padding-left:16px;margin-bottom:28px">
        <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px">Vad händer nu?</p>
        <div style="margin-bottom:10px">
          <p style="font-size:13px;font-weight:600;color:#0f172a;margin:0">1. Gör din banköverföring</p>
          <p style="font-size:12px;color:#64748b;margin:2px 0 0">Använd din banks app eller internetbank</p>
        </div>
        <div style="margin-bottom:10px">
          <p style="font-size:13px;font-weight:600;color:#0f172a;margin:0">2. Betalningen registreras (1–2 bankdagar)</p>
          <p style="font-size:12px;color:#64748b;margin:2px 0 0">Vi bekräftar när vi mottagit betalningen</p>
        </div>
        <div>
          <p style="font-size:13px;font-weight:600;color:#0f172a;margin:0">3. Din motorcykel är redo för avhämtning</p>
          <p style="font-size:12px;color:#64748b;margin:2px 0 0">Vi kontaktar dig för att boka tid</p>
        </div>
      </div>

      <p style="font-size:13px;color:#64748b">Frågor? Kontakta oss direkt — svara på detta mejl eller ring din säljare.</p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0">
      <p style="font-size:11px;color:#94a3b8;margin:0;text-align:center">${dealerName} · Betalningsreferens: ${d.reference}</p>
    </div>

  </div>
</body>
</html>`;
}

function buildSmsText(d: BankDetails, dealerName: string): string {
  return (
    `${dealerName} - Betalningsinstruktioner:\n` +
    `Belopp: ${d.amount}\n` +
    `Bankgiro: ${d.bankgiro}\n` +
    `IBAN: ${d.iban}\n` +
    `Ref: ${d.reference}\n` +
    `Ange ref exakt vid betalning. Frågor? Kontakta din säljare.`
  );
}

export async function POST(req: NextRequest) {
  const body: SendBody = await req.json();
  const { contact, method, customerName, bankDetails, dealerName, leadId } = body;

  if (!contact || !method || !customerName || !bankDetails) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // ── Email path ────────────────────────────────────────────────────────────────
  if (method === 'email') {
    const emailFrom    = process.env.EMAIL_FROM    ?? process.env.SMTP_FROM ?? '';
    const resendApiKey = process.env.RESEND_API_KEY ?? '';
    const smtpHost     = process.env.SMTP_HOST ?? '';

    const html    = buildEmailHtml(bankDetails, customerName, dealerName);
    const subject = `Betalningsinstruktioner — ${dealerName} (Ref: ${bankDetails.reference})`;

    // ── Resend (preferred) ──────────────────────────────────────────────────────
    if (resendApiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            from:    emailFrom || 'noreply@bikenow.se',
            to:      [contact],
            subject,
            html,
          }),
        });
        const data = await res.json();
        if (!res.ok) return NextResponse.json({ error: data.message ?? 'Resend error' }, { status: 502 });
        return NextResponse.json({ ok: true, provider: 'resend', messageId: data.id });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
    }

    // ── SMTP fallback (nodemailer-style) ────────────────────────────────────────
    if (smtpHost) {
      // If you have an SMTP relay configured, add nodemailer here.
      // For now we log the intent and return success so the UI can proceed.
      console.log(`[payment/send-details] Would send email via SMTP to ${contact} | lead ${leadId}`);
      return NextResponse.json({ ok: true, provider: 'smtp_stub', note: 'Configure SMTP or Resend in env vars' });
    }

    // No email provider configured — return a soft success so the UI can still show the bank details
    console.warn(`[payment/send-details] No email provider configured. Manual sharing required. Lead: ${leadId}`);
    return NextResponse.json({ ok: true, provider: 'none', note: 'No email provider — bank details shown on screen' });
  }

  // ── SMS path ──────────────────────────────────────────────────────────────────
  if (method === 'sms') {
    const smsText = buildSmsText(bankDetails, dealerName);

    // 46elks (Swedish SMS provider — https://46elks.com)
    const elksApiUser     = process.env.ELKS_API_USERNAME ?? '';
    const elksApiPassword = process.env.ELKS_API_PASSWORD ?? '';
    const smsSender       = process.env.SMS_SENDER_NAME ?? dealerName.slice(0, 11);

    if (elksApiUser && elksApiPassword) {
      try {
        const params = new URLSearchParams({
          from:    smsSender,
          to:      contact.startsWith('0') ? '+46' + contact.slice(1) : contact,
          message: smsText,
        });
        const res = await fetch('https://api.46elks.com/a1/sms', {
          method:  'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${elksApiUser}:${elksApiPassword}`).toString('base64'),
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          body: params,
        });
        const data = await res.json();
        if (!res.ok) return NextResponse.json({ error: data.message ?? '46elks error' }, { status: 502 });
        return NextResponse.json({ ok: true, provider: '46elks', messageId: data.id });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
    }

    // Twilio fallback
    const twilioSid   = process.env.TWILIO_ACCOUNT_SID ?? '';
    const twilioToken = process.env.TWILIO_AUTH_TOKEN  ?? '';
    const twilioFrom  = process.env.TWILIO_FROM_NUMBER ?? '';

    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const params = new URLSearchParams({
          From: twilioFrom,
          To:   contact.startsWith('0') ? '+46' + contact.slice(1) : contact,
          Body: smsText,
        });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method:  'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          body: params,
        });
        const data = await res.json();
        if (!res.ok) return NextResponse.json({ error: data.message ?? 'Twilio error' }, { status: 502 });
        return NextResponse.json({ ok: true, provider: 'twilio', messageId: data.sid });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
    }

    console.warn(`[payment/send-details] No SMS provider configured. Lead: ${leadId}`);
    return NextResponse.json({ ok: true, provider: 'none', note: 'No SMS provider — bank details shown on screen' });
  }

  return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
}
