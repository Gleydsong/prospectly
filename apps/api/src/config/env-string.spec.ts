import { stripEnvString } from './env-string';

describe('stripEnvString', () => {
  it('strips CR/LF that Render env pastes leave on GOOGLE_CLIENT_ID', () => {
    expect(stripEnvString('abc.apps.googleusercontent.com\n')).toBe(
      'abc.apps.googleusercontent.com',
    );
    expect(stripEnvString('\r\nxyz.apps.googleusercontent.com\r\n')).toBe(
      'xyz.apps.googleusercontent.com',
    );
  });

  it('uses fallback when unset', () => {
    expect(stripEnvString(undefined, 'http://localhost:3000/callback')).toBe(
      'http://localhost:3000/callback',
    );
  });
});
