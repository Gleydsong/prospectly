import { buildCreditsPurchasedEmail } from './credits-purchased-email';

describe('buildCreditsPurchasedEmail', () => {
  it('renders purchase details when all fields are present', () => {
    const content = buildCreditsPurchasedEmail({
      locale: 'pt',
      fullName: 'Ana',
      credits: 5000,
      amountCentavos: 2399,
      currency: 'BRL',
      purchasedAt: new Date('2026-09-03T12:00:00.000Z'),
      balanceAfter: 15450,
      appUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.template).toBe('credits-purchased');
    expect(content.subject).toBe('Compra de créditos confirmada');
    expect(content.html).toContain('5.000');
    expect(content.html).toContain('15.450');
    expect(content.html).toContain('/credits');
    expect(content.html).toContain('Começar a prospectar');
    expect(content.text).toContain('Créditos adquiridos');
  });

  it('omits optional rows when data is unavailable', () => {
    const content = buildCreditsPurchasedEmail({
      locale: 'en',
      credits: 2000,
      appUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.subject).toBe('Credit purchase confirmed');
    expect(content.html).toContain('2,000');
    expect(content.html).not.toContain('Current balance');
    expect(content.html).not.toContain('Amount');
    expect(content.html).toContain('Hi.');
  });

  it('formats very large credit quantities', () => {
    const content = buildCreditsPurchasedEmail({
      locale: 'pt',
      fullName: 'Ana',
      credits: 1_000_000,
      appUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.html).toContain('1.000.000');
  });
});
