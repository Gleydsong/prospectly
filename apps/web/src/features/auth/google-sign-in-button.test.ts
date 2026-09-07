import { GOOGLE_SIGN_IN_SCOPES } from './google-sign-in-scopes';

describe('GOOGLE_SIGN_IN_SCOPES', () => {
  it('stays identity-only and never requests Gmail send or readonly', () => {
    expect(GOOGLE_SIGN_IN_SCOPES).toBe('openid email profile');
    expect(GOOGLE_SIGN_IN_SCOPES).not.toContain('gmail');
    expect(GOOGLE_SIGN_IN_SCOPES).not.toContain('calendar');
  });
});
