import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const ROLE_SV: Record<string, string> = {
  admin:   'Administratör',
  sales:   'Säljare',
  service: 'Service',
};

export async function POST(req: Request) {
  try {
    const { email, name, role, inviteUrl, dealershipName } = await req.json() as {
      email:          string;
      name:           string;
      role:           string;
      inviteUrl:      string;
      dealershipName: string;
    };

    if (!email || !name || !inviteUrl) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const roleLabel = ROLE_SV[role] ?? role;

    const { error } = await resend.emails.send({
      from:    'BikeMeNow <onboarding@resend.dev>',
      to:      email,
      subject: `Inbjudan till ${dealershipName} på BikeMeNow`,
      html: `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#FF6B2C;padding:28px 36px;">
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">BikeMeNow</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#64748b;">Hej ${name},</p>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
              Du har bjudits in till ${dealershipName}
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
              ${dealershipName} har bjudit in dig att gå med i BikeMeNow som
              <strong style="color:#FF6B2C;">${roleLabel}</strong>.
              Klicka på knappen nedan för att verifiera din identitet med BankID och aktivera ditt konto.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#FF6B2C;border-radius:10px;">
                  <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.2px;">
                    Acceptera inbjudan →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
              Länken gäller i 7 dagar. Om du inte begärt den här inbjudan kan du ignorera detta mejl.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 36px 28px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              BikeMeNow · Inbjudan från ${dealershipName}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (error) {
      console.error('[invite/send] Resend error:', error);
      return Response.json({ error: (error as { message?: string }).message ?? 'Failed to send email' }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[invite/send] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
