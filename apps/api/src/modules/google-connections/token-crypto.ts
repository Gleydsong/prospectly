import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_BYTES = 32;
const IV_BYTES = 12;

export function parseTokenEncryptionKey(hex: string): Buffer {
  const trimmed = hex.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(trimmed, 'hex');
}

export function encryptRefreshToken(plain: string, keyHex: string): string {
  const key = parseTokenEncryptionKey(keyHex);
  if (key.length !== KEY_BYTES) {
    throw new Error('encryption key must be 32 bytes');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptRefreshToken(payload: string, keyHex: string): string {
  const key = parseTokenEncryptionKey(keyHex);
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('malformed encrypted token');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
