import { createHmac, randomBytes } from 'node:crypto';

export const WEBHOOK_SIGNATURE_HEADER = 'X-Prospectly-Signature';
export const WEBHOOK_SIGNING_SECRET_PREFIX = 'plwhsec_';

export function generateWebhookSigningSecret(): string {
  return `${WEBHOOK_SIGNING_SECRET_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function buildWebhookSignatureHeader(
  secret: string,
  rawBody: string,
  unixSeconds: number,
): string {
  const v1 = createHmac('sha256', secret).update(`${unixSeconds}.${rawBody}`, 'utf8').digest('hex');
  return `t=${unixSeconds},v1=${v1}`;
}
