import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal'];
const BLOCKED_METADATA_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
  'instance-data.ec2.internal',
]);

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export function isBlockedIp(ip: string): boolean {
  const candidate = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? '';
  if (candidate === '::' || candidate === '::1' || candidate === '0.0.0.0') return true;

  if (candidate.includes(':')) {
    const normalized = candidate;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (/^fe[89ab]/.test(normalized)) return true; // link-local
    if (normalized.startsWith('ff')) return true; // multicast
    if (normalized.startsWith('2001:db8:')) return true; // documentation
    if (normalized.startsWith('2001:10:')) return true; // ORCHID
    if (normalized.startsWith('::ffff:')) {
      return isBlockedIp(normalized.slice('::ffff:'.length));
    }
    return false;
  }

  const parts = candidate.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments and documentation
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true; // documentation
  if (a === 203 && b === 0) return true; // documentation
  if (a >= 224) return true; // multicast and reserved
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
    BLOCKED_METADATA_HOSTNAMES.has(hostname) ||
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

  // Resolve DNS on every call (including redirects) so TOCTOU / DNS rebinding is re-checked.
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
