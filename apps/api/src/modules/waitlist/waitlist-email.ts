import { AppLocale } from '@prisma/client';

export type WaitlistEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function landingBaseUrl(): string {
  const raw =
    process.env.FRONTEND_LANDING_URL?.trim() ||
    process.env.LANDING_URL?.trim() ||
    'https://prospectlyonboard.com';
  const base = raw.replace(/\/$/, '');
  if (/localhost|127\.0\.0\.1/i.test(base)) {
    return 'https://prospectlyonboard.com';
  }
  return base;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildWaitlistConfirmationEmail(locale: AppLocale): WaitlistEmailContent {
  const base = landingBaseUrl();
  const logoUrl = `${base}/brand/prospectly-mark.png`;
  const siteUrl = base;
  const accent = '#2563eb';
  const ink = '#18181b';
  const muted = '#52525b';
  const bg = '#f4f4f5';
  const card = '#ffffff';
  const border = '#e4e4e7';

  if (locale === AppLocale.en) {
    const subject = 'You’re on the Prospectly waitlist';
    const preheader = 'Thanks for joining — we’ll email you when access opens.';
    const text = [
      'Prospectly',
      '',
      'You’re on the waitlist',
      '',
      'Thanks for joining the Prospectly waitlist.',
      'We’re finishing the product for agencies and freelancers who sell websites and local presence.',
      '',
      'What happens next:',
      '• You keep your spot in line',
      '• We’ll email you when it’s your turn to get started',
      '• No spam — only the access notice',
      '',
      `Visit the site: ${siteUrl}`,
      '',
      '— The Prospectly team',
    ].join('\n');

    const html = wrapEmail({
      locale: 'en',
      preheader,
      logoUrl,
      siteUrl,
      accent,
      ink,
      muted,
      bg,
      card,
      border,
      title: 'You’re on the waitlist',
      lead: 'Thanks for joining the <strong style="color:#18181b;">Prospectly</strong> waitlist. We’re finishing the product for agencies and freelancers who sell websites and local presence.',
      bullets: [
        'You keep your spot in line',
        'We’ll email you when it’s your turn to get started',
        'No spam — only the access notice',
      ],
      ctaLabel: 'Visit Prospectly',
      footer: 'You received this email because you joined the Prospectly waitlist.',
    });

    return { subject, text, html };
  }

  const subject = 'Você entrou na lista de espera do Prospectly';
  const preheader = 'Obrigado por entrar — avisamos quando o acesso abrir.';
  const text = [
    'Prospectly',
    '',
    'Você entrou na lista de espera',
    '',
    'Obrigado por entrar na lista de espera do Prospectly.',
    'Estamos finalizando o produto para agências e freelancers que vendem site e presença local.',
    '',
    'Próximos passos:',
    '• Você mantém o lugar na fila',
    '• Avisamos por e-mail quando for a sua vez de começar',
    '• Sem spam — só o aviso de acesso',
    '',
    `Acesse o site: ${siteUrl}`,
    '',
    '— Equipe Prospectly',
  ].join('\n');

  const html = wrapEmail({
    locale: 'pt',
    preheader,
    logoUrl,
    siteUrl,
    accent,
    ink,
    muted,
    bg,
    card,
    border,
    title: 'Você entrou na lista de espera',
    lead: 'Obrigado por entrar na lista de espera do <strong style="color:#18181b;">Prospectly</strong>. Estamos finalizando o produto para agências e freelancers que vendem site e presença local.',
    bullets: [
      'Você mantém o lugar na fila',
      'Avisamos por e-mail quando for a sua vez de começar',
      'Sem spam — só o aviso de acesso',
    ],
    ctaLabel: 'Visitar o Prospectly',
    footer: 'Você recebeu este e-mail porque entrou na lista de espera do Prospectly.',
  });

  return { subject, text, html };
}

function wrapEmail(opts: {
  locale: 'pt' | 'en';
  preheader: string;
  logoUrl: string;
  siteUrl: string;
  accent: string;
  ink: string;
  muted: string;
  bg: string;
  card: string;
  border: string;
  title: string;
  lead: string;
  bullets: string[];
  ctaLabel: string;
  footer: string;
}): string {
  const {
    locale,
    preheader,
    logoUrl,
    siteUrl,
    accent,
    ink,
    muted,
    bg,
    card,
    border,
    title,
    lead,
    bullets,
    ctaLabel,
    footer,
  } = opts;

  const bulletRows = bullets
    .map(
      (item) => `
                  <tr>
                    <td style="padding:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${muted};">
                      <span style="color:${accent};font-weight:700;">✓</span>&nbsp;&nbsp;${escapeHtml(item)}
                    </td>
                  </tr>`,
    )
    .join('');

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
                Waitlist
              </p>
              <h1 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${ink};">
                ${escapeHtml(title)}
              </h1>
              <p style="margin:0 0 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${muted};">
                ${lead}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
                ${bulletRows}
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:8px;background:${accent};">
                    <a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
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
              <br />
              <a href="${escapeHtml(siteUrl)}" style="color:${accent};text-decoration:none;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
