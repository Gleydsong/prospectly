import { greeting } from '../email-format';
import { isSafeHttpUrl } from '../email-html';
import {
  renderEmailLayout,
  resolveEmailLogoUrl,
  resolveSiteUrl,
  type EmailContent,
} from '../email-layout';
import type { EmailLocale } from '../email-theme';

export type WelcomeEmailProps = {
  locale: EmailLocale;
  fullName?: string | null;
  appUrl: string;
};

export function buildWelcomeEmail(input: WelcomeEmailProps): EmailContent {
  const appUrl = isSafeHttpUrl(input.appUrl) ? input.appUrl.replace(/\/$/, '') : resolveSiteUrl();
  const logoUrl = resolveEmailLogoUrl(appUrl);
  const hi = greeting(input.locale, input.fullName);

  if (input.locale === 'en') {
    const subject = 'Welcome to Prospectly';
    const title = 'Welcome to Prospectly';
    const intro = hi;
    const paragraphs = [
      'Your account is ready. Prospectly helps you find and organize B2B prospecting opportunities with more clarity and less manual work.',
      'Start by exploring local businesses, saving leads and keeping your pipeline in one place.',
    ];
    const text = [
      'Prospectly',
      '',
      title,
      '',
      intro,
      paragraphs[0],
      paragraphs[1],
      '',
      `Open Prospectly: ${appUrl}`,
      '',
      'This is an automatic email related to your account.',
    ].join('\n');

    return {
      template: 'welcome',
      subject,
      text,
      html: renderEmailLayout({
        locale: 'en',
        preheader: 'Your Prospectly account is ready. Start prospecting with more clarity.',
        title,
        intro,
        paragraphs,
        button: { label: 'Open Prospectly', href: appUrl },
        footer: 'This is an automatic email related to your Prospectly account.',
        support: true,
        logoUrl,
        siteUrl: resolveSiteUrl(appUrl),
      }),
    };
  }

  const subject = 'Bem-vindo à Prospectly';
  const title = 'Bem-vindo à Prospectly';
  const intro = hi;
  const paragraphs = [
    'Sua conta está pronta. A Prospectly ajuda você a encontrar e organizar oportunidades de prospecção B2B com mais clareza e menos trabalho manual.',
    'Comece explorando negócios locais, salvando leads e acompanhando o pipeline em um só lugar.',
  ];
  const text = [
    'Prospectly',
    '',
    title,
    '',
    intro,
    paragraphs[0],
    paragraphs[1],
    '',
    `Acessar Prospectly: ${appUrl}`,
    '',
    'Este é um e-mail automático relacionado à sua conta.',
  ].join('\n');

  return {
    template: 'welcome',
    subject,
    text,
    html: renderEmailLayout({
      locale: 'pt',
      preheader: 'Sua conta Prospectly está pronta. Comece a prospectar com mais clareza.',
      title,
      intro,
      paragraphs,
      button: { label: 'Acessar Prospectly', href: appUrl },
      footer: 'Este é um e-mail automático relacionado à sua conta Prospectly.',
      support: true,
      logoUrl,
      siteUrl: resolveSiteUrl(appUrl),
    }),
  };
}
