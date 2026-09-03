import { buildAccountActivationEmail } from './account-activation-email';

describe('buildAccountActivationEmail', () => {
  const activationUrl = 'https://app.prospectlyonboard.com/verify-email?token=abc123';

  it('renders Portuguese activation content with fallback URL', () => {
    const content = buildAccountActivationEmail({
      locale: 'pt',
      fullName: 'Ana',
      activationUrl,
      expiresInHours: 24,
      frontendUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.template).toBe('account-activation');
    expect(content.subject).toBe('Ative sua conta na Prospectly');
    expect(content.text).toContain(activationUrl);
    expect(content.html).toContain(activationUrl);
    expect(content.html).toContain('Ativar minha conta');
    expect(content.html).toContain('24 horas');
    expect(content.html).toContain('não criou esta conta');
    expect(content.html).not.toContain('RESEND');
  });

  it('renders English content and handles a missing name', () => {
    const content = buildAccountActivationEmail({
      locale: 'en',
      activationUrl,
      expiresInHours: 24,
      frontendUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.subject).toBe('Activate your Prospectly account');
    expect(content.html).toContain('Hi.');
    expect(content.html).toContain('Activate my account');
  });

  it('escapes a long name without breaking the layout tokens', () => {
    const content = buildAccountActivationEmail({
      locale: 'pt',
      fullName: `<script>alert(1)</script> ${'N'.repeat(120)}`,
      activationUrl,
      expiresInHours: 24,
      frontendUrl: 'https://app.prospectlyonboard.com',
    });

    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
  });
});
