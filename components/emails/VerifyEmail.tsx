import * as React from 'react';

interface VerifyEmailProps {
  code: string;
  name: string;
}

export function VerifyEmail({ code, name }: VerifyEmailProps) {
  return (
    <html lang="sv">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Din verifieringskod — BikeMeNow</title>
      </head>
      <body style={styles.body}>
        <table width="100%" cellPadding="0" cellSpacing="0" style={styles.wrapper}>
          <tr>
            <td align="center" style={{ padding: '32px 16px' }}>
              <table width="560" cellPadding="0" cellSpacing="0" style={styles.card}>

                {/* Orange header */}
                <tr>
                  <td style={styles.header}>
                    <span style={styles.logoText}>BikeMeNow</span>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={styles.body2}>

                    <p style={styles.greeting}>Hej {name},</p>

                    <h1 style={styles.title}>Verifiera din e-postadress</h1>

                    <p style={styles.para}>
                      Använd koden nedan för att slutföra din registrering hos BikeMeNow.
                      Koden är giltig i <strong>10 minuter</strong>.
                    </p>

                    {/* Code box */}
                    <table width="100%" cellPadding="0" cellSpacing="0">
                      <tr>
                        <td style={{ paddingTop: 28, paddingBottom: 28 }}>
                          <div style={styles.codeBox}>
                            <span style={styles.codeText}>{code.slice(0, 3)} {code.slice(3)}</span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <p style={styles.disclaimer}>
                      Om du inte har begärt denna kod kan du ignorera detta mejl.
                      Dela aldrig din kod med någon annan.
                    </p>

                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={styles.footerBar}>
                    <p style={styles.footerText}>
                      BikeMeNow · Verifiering av e-postadress
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: '#f5f5f5',
    margin: 0,
    padding: 0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  },
  wrapper: {
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: 560,
    width: '100%',
  },
  header: {
    backgroundColor: '#E8612A',
    padding: '28px 40px',
    textAlign: 'left' as const,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '0.01em',
  },
  body2: {
    padding: '36px 40px 28px',
  },
  greeting: {
    fontSize: 15,
    color: '#E8612A',
    margin: '0 0 10px',
    fontWeight: 400,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 18px',
    lineHeight: 1.3,
  },
  para: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 1.65,
    margin: 0,
  },
  codeBox: {
    backgroundColor: '#FFF7ED',
    border: '2px solid #FDBA74',
    borderRadius: 12,
    padding: '20px 0',
    textAlign: 'center' as const,
  },
  codeText: {
    fontSize: 40,
    fontWeight: 800,
    color: '#E8612A',
    letterSpacing: '0.18em',
    fontVariantNumeric: 'tabular-nums',
  },
  disclaimer: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 1.6,
    margin: 0,
  },
  footerBar: {
    borderTop: '1px solid #F3F4F6',
    padding: '16px 40px',
    textAlign: 'left' as const,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    margin: 0,
  },
};
