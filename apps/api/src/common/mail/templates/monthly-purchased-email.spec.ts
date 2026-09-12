import { buildMonthlyPurchasedEmail } from './monthly-purchased-email';

describe('buildMonthlyPurchasedEmail', () => {
  it('renders monthly receipt details in Portuguese', () => {
    const content = buildMonthlyPurchasedEmail({
      locale: 'pt',
      fullName: 'Ana',
      amountCentavos: 4999,
      currency: 'BRL',
      purchasedAt: new Date('2026-09-12T12:00:00.000Z'),
      periodEnd: new Date('2026-10-12T12:00:00.000Z'),
      paymentMethod: 'PIX',
      appUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.template).toBe('monthly-purchased');
    expect(content.subject).toBe('Plano mensal confirmado');
    expect(content.html).toContain('Ilimitado mensal');
    expect(content.html).toContain('49,99');
    expect(content.html).toContain('PIX');
    expect(content.html).toContain('/credits');
    expect(content.html).toContain('Acessar Prospectly');
    expect(content.text).toContain('Acesso até');
  });

  it('renders the English receipt without optional rows', () => {
    const content = buildMonthlyPurchasedEmail({
      locale: 'en',
      amountCentavos: 4999,
      currency: 'BRL',
      appUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.subject).toBe('Monthly plan confirmed');
    expect(content.html).toContain('Unlimited monthly');
    expect(content.html).toContain('Hi.');
    expect(content.html).not.toContain('Access until');
    expect(content.html).not.toContain('Payment method');
  });
});
