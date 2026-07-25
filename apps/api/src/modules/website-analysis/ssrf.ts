import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal'];

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export function isBlockedIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;

  if (ip.includes(':')) {
    const normalized = ip.toLowerCase();
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('fe80')) return true; // link-local
    if (normalized.startsWith('::ffff:')) {
      return isBlockedIp(normalized.slice('::ffff:'.length));
    }
    return false;
  }

  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError('Only http and https URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError('URLs with credentials are not allowed');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SsrfBlockedError('Private hostnames are not allowed');
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new SsrfBlockedError('Private IP addresses are not allowed');
    }
    return parsed;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfBlockedError('Unable to resolve hostname');
  }
  if (records.length === 0) {
    throw new SsrfBlockedError('Unable to resolve hostname');
  }
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new SsrfBlockedError('Hostname resolves to a private IP address');
    }
  }

  return parsed;
}
