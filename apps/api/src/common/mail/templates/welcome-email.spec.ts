import { buildWelcomeEmail } from './welcome-email';

describe('buildWelcomeEmail', () => {
  it('renders Portuguese content with the user name and CTA', () => {
    const content = buildWelcomeEmail({
      locale: 'pt',
      fullName: 'Ana Silva',
      appUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.template).toBe('welcome');
    expect(content.subject).toBe('Bem-vindo à Prospectly');
    expect(content.text).toContain('Olá, Ana.');
    expect(content.html).toContain('Olá, Ana.');
    expect(content.html).toContain('Acessar Prospectly');
    expect(content.html).toContain('https://app.prospectlyonboard.com');
    expect(content.html).not.toContain('RESEND_API_KEY');
  });

  it('renders without a first name', () => {
    const content = buildWelcomeEmail({
      locale: 'pt',
      appUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.html).toContain('Olá.');
    expect(content.html).not.toContain('Olá, undefined');
  });

  it('does not execute a javascript URL as the CTA', () => {
    const content = buildWelcomeEmail({
      locale: 'en',
      fullName: 'Ana',
      appUrl: 'javascript:alert(1)',
    });

    expect(content.html).not.toContain('javascript:alert(1)');
    expect(content.subject).toBe('Welcome to Prospectly');
  });
});
