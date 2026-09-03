import { escapeHtml } from '../email-html';
import {
  renderEmailLayout,
  resolveEmailLogoUrl,
  resolveSiteUrl,
  type EmailContent,
} from '../email-layout';
import type { EmailLocale } from '../email-theme';

export type WaitlistConfirmationEmailProps = {
  locale: EmailLocale;
  landingUrl?: string;
};

export function buildWaitlistConfirmationEmail(
  input: EmailLocale | WaitlistConfirmationEmailProps,
): EmailContent {
  const locale: EmailLocale = typeof input === 'string' ? input : input.locale;
  const siteUrl = resolveSiteUrl(typeof input === 'string' ? undefined : input.landingUrl);
  const logoUrl = resolveEmailLogoUrl(siteUrl);

  if (locale === 'en') {
    const subject = 'You’re on the Prospectly waitlist';
    const title = 'You’re on the waitlist';
    const paragraphs = [
      'Thanks for joining the Prospectly waitlist. We’re finishing the product for agencies and freelancers who sell websites and local presence.',
    ];
    const bullets = [
      'You keep your spot in line',
      'We’ll email you when it’s your turn to get started',
      'No spam — only the access notice',
    ];
    const text = [
      'Prospectly',
      '',
      title,
      '',
      paragraphs[0],
      '',
      'What happens next:',
      ...bullets.map((item) => `• ${item}`),
      '',
      `Visit the site: ${siteUrl}`,
      '',
      '— The Prospectly team',
    ].join('\n');

    return {
      template: 'waitlist-confirmation',
      subject,
      text,
      html: renderEmailLayout({
        locale: 'en',
        preheader: 'Thanks for joining — we’ll email you when access opens.',
        eyebrow: 'Waitlist',
        title,
        intro: paragraphs[0]!,
        paragraphs: bullets.map((item) => `• ${item}`),
        button: { label: 'Visit Prospectly', href: siteUrl },
        footer: 'You received this email because you joined the Prospectly waitlist.',
        logoUrl,
        siteUrl,
      }),
    };
  }

  const subject = 'Você entrou na lista de espera do Prospectly';
  const title = 'Você entrou na lista de espera';
  const paragraphs = [
    'Obrigado por entrar na lista de espera do Prospectly. Estamos finalizando o produto para agências e freelancers que vendem site e presença local.',
  ];
  const bullets = [
    'Você mantém o lugar na fila',
    'Avisamos por e-mail quando for a sua vez de começar',
    'Sem spam — só o aviso de acesso',
  ];
  const text = [
    'Prospectly',
    '',
    title,
    '',
    paragraphs[0],
    '',
    'Próximos passos:',
    ...bullets.map((item) => `• ${item}`),
    '',
    `Acesse o site: ${siteUrl}`,
    '',
    '— Equipe Prospectly',
  ].join('\n');

  return {
    template: 'waitlist-confirmation',
    subject,
    text,
    html: renderEmailLayout({
      locale: 'pt',
      preheader: 'Obrigado por entrar — avisamos quando o acesso abrir.',
      eyebrow: 'Lista de espera',
      title,
      intro: paragraphs[0]!,
      paragraphs: bullets.map((item) => `• ${item}`),
      button: { label: 'Visitar o Prospectly', href: siteUrl },
      footer: 'Você recebeu este e-mail porque entrou na lista de espera do Prospectly.',
      logoUrl,
      siteUrl,
    }),
  };
}

export function buildWaitlistNotifyEmail(input: {
  email: string;
  locale: string;
  source: string;
}): EmailContent {
  const subject = `Novo waitlist: ${input.email}`;
  const text = `Novo cadastro na lista de espera.\n\nE-mail: ${input.email}\nLocale: ${input.locale}\nSource: ${input.source}\n`;
  return {
    template: 'waitlist-notify',
    subject,
    text,
    html: `<p>Novo cadastro na lista de espera.</p><p><strong>E-mail:</strong> ${escapeHtml(input.email)}<br/><strong>Locale:</strong> ${escapeHtml(input.locale)}<br/><strong>Source:</strong> ${escapeHtml(input.source)}</p>`,
  };
}
