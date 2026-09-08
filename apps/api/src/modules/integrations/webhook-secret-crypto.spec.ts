import { decryptRefreshToken, encryptRefreshToken } from '../google-connections/token-crypto';

import {
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
} from './webhook-secret-crypto';

const KEY = 'aa'.repeat(32);
const OTHER_KEY = 'bb'.repeat(32);

describe('webhook-secret-crypto', () => {
  it('round-trips a signing secret without storing plaintext', () => {
    const cipher = encryptWebhookSigningSecret('plwhsec_plain', KEY, 'org-1');
    expect(cipher).not.toContain('plwhsec_plain');
    expect(decryptWebhookSigningSecret(cipher, KEY, 'org-1')).toBe('plwhsec_plain');
  });

  it('rejects decrypting with a GoogleConnection blob (distinct associated data)', () => {
    const googleBlob = encryptRefreshToken('refresh-token-plain', KEY);
    expect(() => decryptWebhookSigningSecret(googleBlob, KEY, 'org-1')).toThrow();
    const webhookBlob = encryptWebhookSigningSecret('plwhsec_plain', KEY, 'org-1');
    expect(() => decryptRefreshToken(webhookBlob, KEY)).toThrow();
  });

  it('rejects decrypting with another organizationId or another key', () => {
    const cipher = encryptWebhookSigningSecret('plwhsec_plain', KEY, 'org-1');
    expect(() => decryptWebhookSigningSecret(cipher, KEY, 'org-2')).toThrow();
    expect(() => decryptWebhookSigningSecret(cipher, OTHER_KEY, 'org-1')).toThrow();
  });
});
