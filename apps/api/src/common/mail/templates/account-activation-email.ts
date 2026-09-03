import { greeting } from '../email-format';
import { isSafeHttpUrl } from '../email-html';
import {
  renderEmailLayout,
  resolveEmailLogoUrl,
  resolveSiteUrl,
  type EmailContent,
} from '../email-layout';
import type { EmailLocale } from '../email-theme';

export type AccountActivationEmailProps = {
  locale: EmailLocale;
  fullName?: string | null;
  activationUrl: string;
  expiresInHours: number;
  frontendUrl: string;
};

export function buildAccountActivationEmail(input: AccountActivationEmailProps): EmailContent {
  const frontendUrl = isSafeHttpUrl(input.frontendUrl)
    ? input.frontendUrl.replace(/\/$/, '')
    : resolveSiteUrl();
  const activationUrl = isSafeHttpUrl(input.activationUrl) ? input.activationUrl : frontendUrl;
  const logoUrl = resolveEmailLogoUrl(frontendUrl);
  const hours = Number.isFinite(input.expiresInHours) ? input.expiresInHours : 24;
  const hi = greeting(input.locale, input.fullName);

  if (input.locale === 'en') {
    const subject = 'Activate your Prospectly account';
    const title = 'Activate your account';
    const intro = hi;
    const paragraphs = [
      'One last step before you can use Prospectly. Confirm your email with the button below.',
    ];
    const text = [
      'Prospectly',
      '',
      title,
      '',
      intro,
      paragraphs[0],
      '',
      activationUrl,
      '',
      `This link expires in ${hours} hours.`,
      'If you did not create this account, you can ignore this email.',
    ].join('\n');

    return {
      template: 'account-activation',
      subject,
      text,
      html: renderEmailLayout({
        locale: 'en',
        preheader: 'Activate your account and start using Prospectly.',
        title,
        intro,
        paragraphs,
        button: { label: 'Activate my account', href: activationUrl },
        secondary: [
          `This link expires in ${hours} hours.`,
          'If the button does not work, copy and paste this URL into your browser:',
          'If you did not create this account, you can ignore this email.',
        ],
        fallbackUrl: activationUrl,
        footer: 'This is an automatic email related to your Prospectly account.',
        support: true,
        logoUrl,
        siteUrl: resolveSiteUrl(frontendUrl),
      }),
    };
  }

  const subject = 'Ative sua conta na Prospectly';
  const title = 'Ative sua conta';
  const intro = hi;
  const paragraphs = [
    'Falta apenas um passo para começar a usar a Prospectly. Confirme o seu e-mail pelo botão abaixo.',
  ];
  const text = [
    'Prospectly',
    '',
    title,
    '',
    intro,
    paragraphs[0],
    '',
    activationUrl,
    '',
    `Este link expira em ${hours} horas.`,
    'Se você não criou esta conta, pode ignorar este e-mail.',
  ].join('\n');

  return {
    template: 'account-activation',
    subject,
    text,
    html: renderEmailLayout({
      locale: 'pt',
      preheader: 'Ative sua conta e comece a usar a Prospectly.',
      title,
      intro,
      paragraphs,
      button: { label: 'Ativar minha conta', href: activationUrl },
      secondary: [
        `Este link expira em ${hours} horas.`,
        'Se o botão não funcionar, copie e cole este URL no navegador:',
        'Se você não criou esta conta, pode ignorar este e-mail.',
      ],
      fallbackUrl: activationUrl,
      footer: 'Este é um e-mail automático relacionado à sua conta Prospectly.',
      support: true,
      logoUrl,
      siteUrl: resolveSiteUrl(frontendUrl),
    }),
  };
}
