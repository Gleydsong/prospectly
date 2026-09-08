import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AAD_PREFIX = 'prospectly.webhook.signing-secret.v1';

function parseEncryptionKey(hex: string): Buffer {
  const trimmed = hex.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(trimmed, 'hex');
}

function associatedData(organizationId: string): Buffer {
  return Buffer.from(`${AAD_PREFIX}:${organizationId}`, 'utf8');
}

export function encryptWebhookSigningSecret(
  plain: string,
  keyHex: string,
  organizationId: string,
): string {
  const key = parseEncryptionKey(keyHex);
  if (key.length !== KEY_BYTES) {
    throw new Error('encryption key must be 32 bytes');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(associatedData(organizationId));
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptWebhookSigningSecret(
  payload: string,
  keyHex: string,
  organizationId: string,
): string {
  const key = parseEncryptionKey(keyHex);
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('malformed encrypted webhook signing secret');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAAD(associatedData(organizationId));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
