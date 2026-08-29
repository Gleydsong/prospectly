import { lookup } from 'node:dns/promises';
import type { LookupAddress, LookupOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
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

export type SafePublicUrl = {
  url: URL;
  /** Addresses validated by assertSafePublicUrl — pin these at connect time. */
  addresses: string[];
};

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

function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? '';
}

/**
 * DNS lookup that only returns pre-validated addresses. Prevents TOCTOU /
 * DNS rebinding between assertSafePublicUrl and the TCP/TLS connect.
 */
export function createPinnedLookup(addresses: string[]) {
  const pinned = addresses.map(normalizeAddress).filter(Boolean);
  if (pinned.length === 0) {
    throw new SsrfBlockedError('No resolved addresses to pin');
  }

  type LookupCallback = (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void;

  return (
    _hostname: string,
    options: LookupOptions | LookupCallback,
    callback?: LookupCallback,
  ): void => {
    const cb = (typeof options === 'function' ? options : callback) as LookupCallback;
    const opts = (typeof options === 'function' ? {} : options) as LookupOptions;

    const ipv4 = pinned.find((addr) => isIP(addr) === 4);
    const ipv6 = pinned.find((addr) => isIP(addr) === 6);
    const selected = ipv4 ?? ipv6 ?? pinned[0]!;
    const family = isIP(selected) || 4;

    if (opts.all) {
      cb(
        null,
        pinned.map((address) => ({
          address,
          family: (isIP(address) || 4) as 4 | 6,
        })),
      );
      return;
    }

    cb(null, selected, family);
  };
}

type PinnedFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Analyzer always uses manual redirects; ignore follow. */
  redirect?: 'follow' | 'error' | 'manual';
};

/**
 * HTTP(S) GET/request that connects only to `addresses` while keeping the
 * original hostname for Host / TLS SNI + certificate verification.
 */
export async function fetchWithPinnedDns(
  url: string,
  addresses: string[],
  init: PinnedFetchInit = {},
): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError('Only http and https URLs are allowed');
  }

  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;
  const lookupFn = createPinnedLookup(addresses);

  return new Promise<Response>((resolve, reject) => {
    const request = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        ...(isHttps ? { servername: parsed.hostname } : {}),
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: init.method ?? 'GET',
        headers: init.headers,
        lookup: lookupFn,
      },
      (incoming) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value === undefined) continue;
          if (Array.isArray(value)) {
            for (const item of value) headers.append(key, item);
          } else {
            headers.set(key, value);
          }
        }

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            incoming.on('data', (chunk: Buffer | string) => {
              const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
              controller.enqueue(new Uint8Array(buffer));
            });
            incoming.on('end', () => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            });
            incoming.on('error', (err) => controller.error(err));
          },
          cancel() {
            incoming.destroy();
          },
        });

        resolve(
          new Response(stream, {
            status: incoming.statusCode ?? 0,
            statusText: incoming.statusMessage,
            headers,
          }),
        );
      },
    );

    request.on('error', reject);

    if (init.signal) {
      if (init.signal.aborted) {
        request.destroy(new DOMException('This operation was aborted', 'AbortError'));
        return;
      }
      const onAbort = () => {
        request.destroy(new DOMException('This operation was aborted', 'AbortError'));
      };
      init.signal.addEventListener('abort', onAbort, { once: true });
      request.on('close', () => init.signal?.removeEventListener('abort', onAbort));
    }

    request.end();
  });
}

export async function assertSafePublicUrl(rawUrl: string): Promise<SafePublicUrl> {
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
    return { url: parsed, addresses: [normalizeAddress(hostname)] };
  }

  // Resolve DNS on every call (including redirects). Callers must pin these
  // addresses at connect time — a later fetch() re-resolve can rebind to a
  // private IP (TOCTOU).
  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfBlockedError('Unable to resolve hostname');
  }
  if (records.length === 0) {
    throw new SsrfBlockedError('Unable to resolve hostname');
  }
  const addresses: string[] = [];
  for (const record of records) {
    const address = normalizeAddress(record.address);
    if (isBlockedIp(address)) {
      throw new SsrfBlockedError('Hostname resolves to a private IP address');
    }
    addresses.push(address);
  }

  return { url: parsed, addresses };
}
