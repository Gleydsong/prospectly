import { decryptRefreshToken, encryptRefreshToken } from './token-crypto';

const KEY = 'aa'.repeat(32);

describe('token-crypto', () => {
  it('round-trips a refresh token and does not store the plaintext', () => {
    const cipher = encryptRefreshToken('refresh-token-plain', KEY);
    expect(cipher).not.toContain('refresh-token-plain');
    expect(decryptRefreshToken(cipher, KEY)).toBe('refresh-token-plain');
  });

  it('rejects a short encryption key', () => {
    expect(() => encryptRefreshToken('x', 'abcd')).toThrow(/64 hex/);
  });
});
