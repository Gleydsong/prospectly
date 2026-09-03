import { buildPasswordResetEmail } from './password-reset-email';

describe('buildPasswordResetEmail', () => {
  it('builds Portuguese content with escaped reset URL', () => {
    const content = buildPasswordResetEmail({
      locale: 'pt',
      resetUrl: 'https://app.example.com/reset-password?token=abc123',
      frontendUrl: 'https://app.example.com',
    });

    expect(content.subject).toMatch(/senha/i);
    expect(content.text).toContain('https://app.example.com/reset-password?token=abc123');
    expect(content.html).toContain('https://app.example.com/reset-password?token=abc123');
    expect(content.html).toContain('Redefinir senha');
  });

  it('builds English content', () => {
    const content = buildPasswordResetEmail({
      locale: 'en',
      resetUrl: 'https://app.example.com/reset-password?token=xyz',
      frontendUrl: 'https://app.example.com',
    });

    expect(content.subject).toMatch(/password/i);
    expect(content.text).toContain('token=xyz');
    expect(content.html).toContain('Choose a new password');
  });
});
