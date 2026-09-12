import { formatCurrencyFromCentavos, formatEmailDate, greeting } from '../email-format';
import { isSafeHttpUrl } from '../email-html';
import {
  renderEmailLayout,
  resolveEmailLogoUrl,
  resolveSiteUrl,
  type EmailContent,
} from '../email-layout';
import type { EmailLocale } from '../email-theme';

export type MonthlyPurchasedEmailProps = {
  locale: EmailLocale;
  fullName?: string | null;
  amountCentavos: number;
  currency: string;
  purchasedAt?: Date;
  periodEnd?: Date | null;
  paymentMethod?: 'PIX' | 'CARD';
  appUrl: string;
};

export function buildMonthlyPurchasedEmail(input: MonthlyPurchasedEmailProps): EmailContent {
  const appUrl = isSafeHttpUrl(input.appUrl) ? input.appUrl.replace(/\/$/, '') : resolveSiteUrl();
  const creditsUrl = `${appUrl}/credits`;
  const logoUrl = resolveEmailLogoUrl(appUrl);
  const hi = greeting(input.locale, input.fullName);
  const amount = formatCurrencyFromCentavos(input.amountCentavos, input.currency, input.locale);
  const methodLabel = monthlyMethodLabel(input.locale, input.paymentMethod);
  const infoRows: { label: string; value: string }[] = [
    {
      label: input.locale === 'en' ? 'Plan' : 'Plano',
      value: input.locale === 'en' ? 'Unlimited monthly' : 'Ilimitado mensal',
    },
    {
      label: input.locale === 'en' ? 'Amount' : 'Valor',
      value: amount,
    },
  ];

  if (methodLabel) {
    infoRows.push({
      label: input.locale === 'en' ? 'Payment method' : 'Pagamento',
      value: methodLabel,
    });
  }
  if (input.purchasedAt) {
    infoRows.push({
      label: input.locale === 'en' ? 'Date' : 'Data',
      value: formatEmailDate(input.purchasedAt, input.locale),
    });
  }
  if (input.periodEnd) {
    infoRows.push({
      label: input.locale === 'en' ? 'Access until' : 'Acesso até',
      value: formatEmailDate(input.periodEnd, input.locale),
    });
  }

  if (input.locale === 'en') {
    const subject = 'Monthly plan confirmed';
    const title = 'Purchase confirmed';
    const paragraphs = [
      'Your unlimited monthly plan is active. Prospectly will not debit credits while this plan is in effect.',
    ];
    const text = [
      'Prospectly',
      '',
      title,
      '',
      hi,
      paragraphs[0],
      '',
      amount,
      ...infoRows.map((row) => `${row.label}: ${row.value}`),
      '',
      `Open Prospectly: ${creditsUrl}`,
    ].join('\n');

    return {
      template: 'monthly-purchased',
      subject,
      text,
      html: renderEmailLayout({
        locale: 'en',
        preheader: 'Your unlimited monthly plan is now active.',
        title,
        intro: hi,
        paragraphs,
        highlight: { label: 'Unlimited monthly', value: amount },
        infoRows,
        button: { label: 'Open Prospectly', href: creditsUrl },
        footer: 'This is an automatic email related to your Prospectly account.',
        support: true,
        logoUrl,
        siteUrl: resolveSiteUrl(appUrl),
      }),
    };
  }

  const subject = 'Plano mensal confirmado';
  const title = 'Compra confirmada';
  const paragraphs = [
    'Seu plano ilimitado mensal está ativo. A Prospectly não debita créditos enquanto este plano estiver vigente.',
  ];
  const text = [
    'Prospectly',
    '',
    title,
    '',
    hi,
    paragraphs[0],
    '',
    amount,
    ...infoRows.map((row) => `${row.label}: ${row.value}`),
    '',
    `Acessar Prospectly: ${creditsUrl}`,
  ].join('\n');

  return {
    template: 'monthly-purchased',
    subject,
    text,
    html: renderEmailLayout({
      locale: 'pt',
      preheader: 'Seu plano ilimitado mensal já está ativo.',
      title,
      intro: hi,
      paragraphs,
      highlight: { label: 'Ilimitado mensal', value: amount },
      infoRows,
      button: { label: 'Acessar Prospectly', href: creditsUrl },
      footer: 'Este é um e-mail automático relacionado à sua conta Prospectly.',
      support: true,
      logoUrl,
      siteUrl: resolveSiteUrl(appUrl),
    }),
  };
}

function monthlyMethodLabel(
  locale: EmailLocale,
  paymentMethod: MonthlyPurchasedEmailProps['paymentMethod'],
): string | null {
  if (paymentMethod === 'PIX') return 'PIX';
  if (paymentMethod === 'CARD') return locale === 'en' ? 'Card' : 'Cartão';
  return null;
}
