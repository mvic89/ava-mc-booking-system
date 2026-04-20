// POST /api/nps/send
// Creates an NPS survey record and emails the customer a unique link

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import nodemailer from 'nodemailer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealershipId: string;
      leadId?: number;
      customerId?: number;
      recipientName: string;
      recipientEmail: string;
    };

    const { dealershipId, leadId, customerId, recipientName, recipientEmail } = body;
    if (!dealershipId || !recipientEmail)
      return NextResponse.json({ error: 'Missing dealershipId or recipientEmail' }, { status: 400 });

    // Create survey record
    const { data: survey, error: insertErr } = await sb()
      .from('nps_surveys')
      .insert({
        dealership_id:   dealershipId,
        lead_id:         leadId   ?? null,
        customer_id:     customerId ?? null,
        recipient_name:  recipientName,
        recipient_email: recipientEmail,
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    const token   = survey.token as string;
    const surveyUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/nps/${token}`;

    // Send email (optional — skip if SMTP not configured)
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT ?? '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
          to:      recipientEmail,
          subject: 'Hur nöjd är du? – Betygsätt ditt köp',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
              <h2 style="color:#FF6B2C">Hur var din upplevelse?</h2>
              <p>Hej ${recipientName},</p>
              <p>Vi vill gärna veta hur nöjd du är med ditt senaste köp hos oss.
                 Det tar bara 30 sekunder!</p>
              <a href="${surveyUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;
                 background:#FF6B2C;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
                Betygsätt nu →
              </a>
              <p style="color:#888;font-size:12px">Länken är giltig i 30 dagar.</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.warn('[nps/send] Email failed:', mailErr);
        // Don't fail the whole request — survey is created, email is best-effort
      }
    }

    return NextResponse.json({ survey, surveyUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
