import { createGoogleOAuthState, parseGoogleOAuthState } from './oauth-state';

const SECRET = 'test-jwt-access-secret-min-32-chars!!';

describe('google OAuth state', () => {
  it('round-trips user and org', () => {
    const state = createGoogleOAuthState({ userId: 'u1', organizationId: 'org-1' }, SECRET);
    expect(parseGoogleOAuthState(state, SECRET)).toEqual({ userId: 'u1', organizationId: 'org-1' });
  });

  it('rejects a tampered payload', () => {
    const state = createGoogleOAuthState({ userId: 'u1', organizationId: 'org-1' }, SECRET);
    expect(() => parseGoogleOAuthState(`${state}x`, SECRET)).toThrow('invalid_state');
  });

  it('rejects an expired state', () => {
    const state = createGoogleOAuthState(
      { userId: 'u1', organizationId: 'org-1' },
      SECRET,
      Date.now() - 11 * 60 * 1000,
    );
    expect(() => parseGoogleOAuthState(state, SECRET)).toThrow('expired_state');
  });
});
