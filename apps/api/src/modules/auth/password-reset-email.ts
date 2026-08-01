export type PasswordResetEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logoUrlFromFrontend(frontendUrl: string): string {
  try {
    const origin = new URL(frontendUrl).origin;
    return `${origin}/brand/prospectly-mark.png`;
  } catch {
    return 'https://prospectlyonboard.com/brand/prospectly-mark.png';
  }
}

export function buildPasswordResetEmail(input: {
  locale: 'pt' | 'en';
  resetUrl: string;
  frontendUrl: string;
}): PasswordResetEmailContent {
  const { locale, resetUrl, frontendUrl } = input;
  const logoUrl = logoUrlFromFrontend(frontendUrl);
  const accent = '#2563eb';
  const ink = '#18181b';
  const muted = '#52525b';
  const bg = '#f4f4f5';
  const card = '#ffffff';
  const border = '#e4e4e7';

  if (locale === 'en') {
    const subject = 'Reset your Prospectly password';
    const preheader = 'Use this link within 1 hour to choose a new password.';
    const text = [
      'Prospectly',
      '',
      'Reset your password',
      '',
      'We received a request to reset the password for your Prospectly account.',
      'Open the link below within 1 hour. If you did not request this, you can ignore this email.',
      '',
      resetUrl,
      '',
      '— The Prospectly team',
    ].join('\n');

    const html = wrapResetEmail({
      locale: 'en',
      preheader,
      logoUrl,
      resetUrl,
      accent,
      ink,
      muted,
      bg,
      card,
      border,
      title: 'Reset your password',
      lead: 'We received a request to reset the password for your <strong style="color:#18181b;">Prospectly</strong> account. This link expires in 1 hour.',
      ctaLabel: 'Choose a new password',
      footer: 'If you did not request a password reset, you can ignore this email.',
    });

    return { subject, text, html };
  }

  const subject = 'Redefina a sua senha no Prospectly';
  const preheader = 'Use este link em até 1 hora para escolher uma nova senha.';
  const text = [
    'Prospectly',
    '',
    'Redefinir senha',
    '',
    'Recebemos um pedido para redefinir a senha da sua conta Prospectly.',
    'Abra o link abaixo em até 1 hora. Se não foi você, ignore este e-mail.',
    '',
    resetUrl,
    '',
    '— Equipe Prospectly',
  ].join('\n');

  const html = wrapResetEmail({
    locale: 'pt',
    preheader,
    logoUrl,
    resetUrl,
    accent,
    ink,
    muted,
    bg,
    card,
    border,
    title: 'Redefinir senha',
    lead: 'Recebemos um pedido para redefinir a senha da sua conta <strong style="color:#18181b;">Prospectly</strong>. Este link expira em 1 hora.',
    ctaLabel: 'Escolher nova senha',
    footer: 'Se você não pediu a redefinição de senha, ignore este e-mail.',
  });

  return { subject, text, html };
}

function wrapResetEmail(opts: {
  locale: 'pt' | 'en';
  preheader: string;
  logoUrl: string;
  resetUrl: string;
  accent: string;
  ink: string;
  muted: string;
  bg: string;
  card: string;
  border: string;
  title: string;
  lead: string;
  ctaLabel: string;
  footer: string;
}): string {
  const {
    locale,
    preheader,
    logoUrl,
    resetUrl,
    accent,
    ink,
    muted,
    bg,
    card,
    border,
    title,
    lead,
    ctaLabel,
    footer,
  } = opts;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${card};border:1px solid ${border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px 28px;border-bottom:1px solid ${border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="Prospectly" style="display:block;border:0;border-radius:8px;" />
                  </td>
                  <td style="vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${ink};">
                    Prospectly
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${accent};">
                Security
              </p>
              <h1 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${ink};">
                ${escapeHtml(title)}
              </h1>
              <p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${muted};">
                ${lead}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:8px;background:${accent};">
                    <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      ${escapeHtml(ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#fafafa;border-top:1px solid ${border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${muted};">
              ${escapeHtml(footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
