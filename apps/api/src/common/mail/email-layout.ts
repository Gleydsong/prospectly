import { escapeHtml, isSafeHttpUrl, publicOrigin } from './email-html';
import { emailTheme, type EmailLocale } from './email-theme';

export type EmailContent = {
  subject: string;
  text: string;
  html: string;
  template: string;
};

type EmailButton = {
  label: string;
  href: string;
};

type EmailInfoRow = {
  label: string;
  value: string;
};

export type EmailLayoutInput = {
  locale: EmailLocale;
  preheader: string;
  eyebrow?: string;
  title: string;
  intro: string;
  paragraphs?: string[];
  highlight?: { label: string; value: string };
  infoRows?: EmailInfoRow[];
  button?: EmailButton;
  secondary?: string[];
  fallbackUrl?: string;
  footer: string;
  support?: boolean;
  logoUrl: string;
  siteUrl: string;
};

const FONT = emailTheme.layout.fontFamily;

function safeHref(value: string): string {
  return isSafeHttpUrl(value) ? value : '#';
}

export function resolveEmailLogoUrl(_frontendOrLandingUrl?: string): string {
  return `${emailTheme.brand.defaultSiteUrl}${emailTheme.brand.logoPath}`;
}

export function resolveSiteUrl(rawUrl?: string): string {
  return publicOrigin(rawUrl, emailTheme.brand.defaultSiteUrl);
}

function renderButton(button: EmailButton): string {
  const href = escapeHtml(safeHref(button.href));
  const label = escapeHtml(button.label);
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td bgcolor="${emailTheme.colors.primary}" style="border-radius:${emailTheme.radius.button};background:${emailTheme.colors.primary};">
                    <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-size:15px;line-height:1.2;font-weight:600;color:${emailTheme.colors.primaryText};text-decoration:none;">
                      ${label}
                    </a>
                  </td>
                </tr>
              </table>`;
}

function renderHighlight(highlight: { label: string; value: string }): string {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
                <tr>
                  <td style="padding:18px 20px;background:${emailTheme.colors.successSurface};border:1px solid ${emailTheme.colors.border};border-radius:${emailTheme.radius.button};text-align:center;">
                    <p style="margin:0 0 4px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${emailTheme.colors.success};">
                      ${escapeHtml(highlight.label)}
                    </p>
                    <p style="margin:0;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.03em;color:${emailTheme.colors.text};">
                      ${escapeHtml(highlight.value)}
                    </p>
                  </td>
                </tr>
              </table>`;
}

function renderInfoRows(rows: EmailInfoRow[]): string {
  const body = rows
    .map(
      (row, index) => `
                <tr>
                  <td style="padding:${index === 0 ? '0' : '10px'} 0 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${emailTheme.colors.muted};">
                    ${escapeHtml(row.label)}
                  </td>
                  <td align="right" style="padding:${index === 0 ? '0' : '10px'} 0 0 0;font-family:${FONT};font-size:14px;line-height:1.5;font-weight:600;color:${emailTheme.colors.text};">
                    ${escapeHtml(row.value)}
                  </td>
                </tr>`,
    )
    .join('');

  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;padding:16px 18px;background:${emailTheme.colors.footer};border:1px solid ${emailTheme.colors.border};border-radius:${emailTheme.radius.button};">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${body}
                    </table>
                  </td>
                </tr>
              </table>`;
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const paragraphs = (input.paragraphs ?? [])
    .map(
      (item) => `
              <p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${emailTheme.colors.muted};">
                ${escapeHtml(item)}
              </p>`,
    )
    .join('');

  const secondary = (input.secondary ?? [])
    .map(
      (item) => `
              <p style="margin:0 0 12px 0;font-family:${FONT};font-size:13px;line-height:1.55;color:${emailTheme.colors.muted};">
                ${escapeHtml(item)}
              </p>`,
    )
    .join('');

  const fallback = input.fallbackUrl
    ? `
              <p style="margin:8px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.55;color:${emailTheme.colors.muted};word-break:break-all;">
                ${escapeHtml(input.fallbackUrl)}
              </p>`
    : '';

  const support = input.support
    ? `
              <p style="margin:12px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${emailTheme.colors.muted};">
                ${input.locale === 'en' ? 'Need help?' : 'Precisa de ajuda?'}
                <a href="mailto:${emailTheme.brand.supportEmail}" style="color:${emailTheme.colors.primary};text-decoration:none;">${emailTheme.brand.supportEmail}</a>
              </p>`
    : '';

  const eyebrow = input.eyebrow
    ? `
              <p style="margin:0 0 8px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${emailTheme.colors.primary};">
                ${escapeHtml(input.eyebrow)}
              </p>`
    : '';

  const siteHref = escapeHtml(safeHref(input.siteUrl));
  const siteLabel = escapeHtml(input.siteUrl.replace(/^https?:\/\//, ''));

  return `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${emailTheme.colors.background};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(input.preheader)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${emailTheme.colors.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${emailTheme.layout.contentWidth};background:${emailTheme.colors.surface};border:1px solid ${emailTheme.colors.border};border-radius:${emailTheme.radius.card};overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 16px 28px;border-bottom:1px solid ${emailTheme.colors.border};background:${emailTheme.colors.surface};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${escapeHtml(input.logoUrl)}" width="40" height="40" alt="${emailTheme.brand.name}" style="display:block;border:0;border-radius:${emailTheme.radius.logo};" />
                  </td>
                  <td style="vertical-align:middle;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${emailTheme.colors.text};">
                    ${emailTheme.brand.name}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;background:${emailTheme.colors.surface};">
              ${eyebrow}
              <h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${emailTheme.colors.text};">
                ${escapeHtml(input.title)}
              </h1>
              <p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${emailTheme.colors.muted};">
                ${escapeHtml(input.intro)}
              </p>
              ${paragraphs}
              ${input.highlight ? renderHighlight(input.highlight) : ''}
              ${input.infoRows?.length ? renderInfoRows(input.infoRows) : ''}
              ${input.button ? renderButton(input.button) : ''}
              ${secondary}
              ${fallback}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:${emailTheme.colors.footer};border-top:1px solid ${emailTheme.colors.border};font-family:${FONT};font-size:12px;line-height:1.5;color:${emailTheme.colors.muted};">
              ${escapeHtml(input.footer)}
              ${support}
              <p style="margin:12px 0 0 0;">
                ${emailTheme.brand.name}<br />
                <a href="${siteHref}" style="color:${emailTheme.colors.primary};text-decoration:none;">${siteLabel}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
