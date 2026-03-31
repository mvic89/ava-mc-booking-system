import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';

const resend = new Resend(process.env.RESEND_API_KEY);
const TOKEN_TTL_HOURS = 1;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email: string };
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const normalised = email.toLowerCase().trim();
    const sb = getSupabaseAdmin();

    // Look up staff user — silently skip if not found (prevents email enumeration)
    // Select only the base columns that are guaranteed to exist
    const { data: staffRow } = await (sb as any)
      .from('staff_users')
      .select('name, email')
      .eq('email', normalised)
      .maybeSingle() as { data: { name: string; email: string } | null };

    // Try to also read recovery_email (column may not exist on all deployments)
    let recoveryEmail: string | null = null;
    if (staffRow) {
      try {
        const { data: extra } = await (sb as any)
          .from('staff_users')
          .select('recovery_email')
          .eq('email', normalised)
          .maybeSingle() as { data: { recovery_email: string | null } | null };
        recoveryEmail = extra?.recovery_email ?? null;
      } catch { /* column not added yet — ignore */ }
    }

    if (staffRow) {
      // Invalidate any existing unused tokens for this email
      await (sb as any)
        .from('password_reset_tokens')
        .delete()
        .eq('email', normalised)
        .eq('used', false);

      // Generate a cryptographically secure, single-use token
      const token     = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

      await (sb as any).from('password_reset_tokens').insert({
        email:      normalised,
        token,
        expires_at: expiresAt,
      });

      // Build the reset URL
      const origin   = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
      const resetUrl = `${origin}/auth/reset-password?token=${token}`;

      // Send to recovery_email if set, otherwise fall back to the login email
      const deliverTo = recoveryEmail ?? staffRow.email;
      await resend.emails.send({
        from:    'BikeMeNow <no-reply@contact.bikeme.now>',
        to:      deliverTo,
        subject: 'Återställ ditt BikeMeNow-lösenord',
        html:    buildResetEmail(staffRow.name ?? normalised, resetUrl),
      });
    }

    // Always return ok — prevents revealing whether the email is registered
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[auth/forgot-password]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildResetEmail(name: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f1f2e;padding:28px 36px;">
            <span style="font-size:22px;font-weight:800;color:#FF6B2C;letter-spacing:-0.5px;">BikeMeNow</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#64748b;">Hej ${name},</p>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
              Återställ ditt lösenord
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
              Vi har tagit emot en begäran om att återställa lösenordet för ditt BikeMeNow-konto.
              Klicka på knappen nedan för att välja ett nytt lösenord.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#FF6B2C;border-radius:10px;">
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.2px;">
                    Återställ lösenord →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
              Länken är giltig i ${TOKEN_TTL_HOURS} timme. Om du inte begärt återställningen kan du ignorera detta mejl.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 36px 28px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">BikeMeNow · Lösenordsåterställning</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
