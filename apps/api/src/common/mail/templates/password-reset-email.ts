import { isSafeHttpUrl } from '../email-html';
import {
  renderEmailLayout,
  resolveEmailLogoUrl,
  resolveSiteUrl,
  type EmailContent,
} from '../email-layout';
import type { EmailLocale } from '../email-theme';

export type PasswordResetEmailProps = {
  locale: EmailLocale;
  resetUrl: string;
  frontendUrl: string;
};

export function buildPasswordResetEmail(input: PasswordResetEmailProps): EmailContent {
  const frontendUrl = isSafeHttpUrl(input.frontendUrl)
    ? input.frontendUrl.replace(/\/$/, '')
    : resolveSiteUrl();
  const resetUrl = isSafeHttpUrl(input.resetUrl) ? input.resetUrl : frontendUrl;
  const logoUrl = resolveEmailLogoUrl(frontendUrl);

  if (input.locale === 'en') {
    const subject = 'Reset your Prospectly password';
    const title = 'Reset your password';
    const paragraphs = [
      'We received a request to reset the password for your Prospectly account. This link expires in 1 hour.',
    ];
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

    return {
      template: 'password-reset',
      subject,
      text,
      html: renderEmailLayout({
        locale: 'en',
        preheader: 'Use this link within 1 hour to choose a new password.',
        eyebrow: 'Security',
        title,
        intro: paragraphs[0]!,
        button: { label: 'Choose a new password', href: resetUrl },
        secondary: ['If you did not request a password reset, you can ignore this email.'],
        footer: 'This is an automatic email related to your Prospectly account.',
        support: true,
        logoUrl,
        siteUrl: resolveSiteUrl(frontendUrl),
      }),
    };
  }

  const subject = 'Redefina a sua senha no Prospectly';
  const title = 'Redefinir senha';
  const paragraphs = [
    'Recebemos um pedido para redefinir a senha da sua conta Prospectly. Este link expira em 1 hora.',
  ];
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

  return {
    template: 'password-reset',
    subject,
    text,
    html: renderEmailLayout({
      locale: 'pt',
      preheader: 'Use este link em até 1 hora para escolher uma nova senha.',
      eyebrow: 'Segurança',
      title,
      intro: paragraphs[0]!,
      button: { label: 'Escolher nova senha', href: resetUrl },
      secondary: ['Se você não pediu a redefinição de senha, ignore este e-mail.'],
      footer: 'Este é um e-mail automático relacionado à sua conta Prospectly.',
      support: true,
      logoUrl,
      siteUrl: resolveSiteUrl(frontendUrl),
    }),
  };
}
