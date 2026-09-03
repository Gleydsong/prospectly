import {
  formatCredits,
  formatCurrencyFromCentavos,
  formatEmailDate,
  greeting,
} from '../email-format';
import { isSafeHttpUrl } from '../email-html';
import {
  renderEmailLayout,
  resolveEmailLogoUrl,
  resolveSiteUrl,
  type EmailContent,
} from '../email-layout';
import type { EmailLocale } from '../email-theme';

export type CreditsPurchasedEmailProps = {
  locale: EmailLocale;
  fullName?: string | null;
  credits: number;
  amountCentavos?: number;
  currency?: string;
  purchasedAt?: Date;
  balanceAfter?: number;
  appUrl: string;
};

export function buildCreditsPurchasedEmail(input: CreditsPurchasedEmailProps): EmailContent {
  const appUrl = isSafeHttpUrl(input.appUrl) ? input.appUrl.replace(/\/$/, '') : resolveSiteUrl();
  const creditsUrl = `${appUrl}/credits`;
  const logoUrl = resolveEmailLogoUrl(appUrl);
  const creditsLabel = formatCredits(input.credits, input.locale);
  const hi = greeting(input.locale, input.fullName);
  const infoRows: { label: string; value: string }[] = [
    {
      label: input.locale === 'en' ? 'Credits purchased' : 'Créditos adquiridos',
      value: creditsLabel,
    },
  ];

  if (typeof input.amountCentavos === 'number' && input.currency) {
    infoRows.push({
      label: input.locale === 'en' ? 'Amount' : 'Valor',
      value: formatCurrencyFromCentavos(input.amountCentavos, input.currency, input.locale),
    });
  }
  if (input.purchasedAt) {
    infoRows.push({
      label: input.locale === 'en' ? 'Date' : 'Data',
      value: formatEmailDate(input.purchasedAt, input.locale),
    });
  }
  if (typeof input.balanceAfter === 'number') {
    infoRows.push({
      label: input.locale === 'en' ? 'Current balance' : 'Saldo atual',
      value: `${formatCredits(input.balanceAfter, input.locale)} ${
        input.locale === 'en' ? 'credits' : 'créditos'
      }`,
    });
  }

  if (input.locale === 'en') {
    const subject = 'Credit purchase confirmed';
    const title = 'Purchase confirmed';
    const paragraphs = ['Your credit purchase was processed successfully. The credits are now available in your organization.'];
    const text = [
      'Prospectly',
      '',
      title,
      '',
      hi,
      paragraphs[0],
      '',
      `+ ${creditsLabel} credits`,
      ...infoRows.map((row) => `${row.label}: ${row.value}`),
      '',
      `Open Prospectly: ${creditsUrl}`,
    ].join('\n');

    return {
      template: 'credits-purchased',
      subject,
      text,
      html: renderEmailLayout({
        locale: 'en',
        preheader: 'Your new credits are already available.',
        title,
        intro: hi,
        paragraphs,
        highlight: { label: 'Credits added', value: `+ ${creditsLabel}` },
        infoRows,
        button: { label: 'Start prospecting', href: creditsUrl },
        footer: 'This is an automatic email related to your Prospectly account.',
        support: true,
        logoUrl,
        siteUrl: resolveSiteUrl(appUrl),
      }),
    };
  }

  const subject = 'Compra de créditos confirmada';
  const title = 'Compra confirmada';
  const paragraphs = [
    'Sua compra de créditos foi processada com sucesso. Os créditos já estão disponíveis na sua organização.',
  ];
  const text = [
    'Prospectly',
    '',
    title,
    '',
    hi,
    paragraphs[0],
    '',
    `+ ${creditsLabel} créditos`,
    ...infoRows.map((row) => `${row.label}: ${row.value}`),
    '',
    `Acessar Prospectly: ${creditsUrl}`,
  ].join('\n');

  return {
    template: 'credits-purchased',
    subject,
    text,
    html: renderEmailLayout({
      locale: 'pt',
      preheader: 'Seus novos créditos já estão disponíveis.',
      title,
      intro: hi,
      paragraphs,
      highlight: { label: 'Créditos adicionados', value: `+ ${creditsLabel}` },
      infoRows,
      button: { label: 'Começar a prospectar', href: creditsUrl },
      footer: 'Este é um e-mail automático relacionado à sua conta Prospectly.',
      support: true,
      logoUrl,
      siteUrl: resolveSiteUrl(appUrl),
    }),
  };
}
