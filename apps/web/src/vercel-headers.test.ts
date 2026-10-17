import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

type VercelHeaderItem = {
  key: string;
  value: string;
};

type VercelHeaderRule = {
  source: string;
  headers: VercelHeaderItem[];
};

type VercelConfig = {
  $schema?: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  rewrites?: Array<{ source: string; destination: string }>;
  headers?: VercelHeaderRule[];
};

function parseNginxHeaders(conf: string): {
  serverHeaders: Record<string, string>;
  assetHeaders: Record<string, string>;
  assetMaxAge: number;
} {
  const serverHeaders: Record<string, string> = {};
  const assetHeaders: Record<string, string> = {};

  const assetBlockMatch = conf.match(/location\s+\/assets\/\s*\{([^}]+)\}/);
  const assetBlock = assetBlockMatch ? assetBlockMatch[1] : '';
  const serverBlock = conf.replace(/location\s+\/assets\/\s*\{[^}]+\}/, '');

  const headerRegex = /add_header\s+([\w-]+)\s+"([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = headerRegex.exec(serverBlock)) !== null) {
    serverHeaders[match[1]] = match[2];
  }

  while ((match = headerRegex.exec(assetBlock)) !== null) {
    assetHeaders[match[1]] = match[2];
  }

  // nginx's expires directive adds max-age separately from add_header Cache-Control.
  const expiresDays = assetBlock.match(/expires\s+(\d+)d\s*;/)?.[1];
  const assetMaxAge = Number(expiresDays) * 24 * 60 * 60;

  return { serverHeaders, assetHeaders, assetMaxAge };
}

describe('vercel.json deployment configuration and header parity', () => {
  const vercelPath = join(webRoot, 'vercel.json');
  const nginxPath = join(webRoot, 'nginx.conf');

  const vercelRaw = readFileSync(vercelPath, 'utf8');
  const nginxRaw = readFileSync(nginxPath, 'utf8');

  it('parses as valid JSON conforming to Vercel SPA specifications', () => {
    expect(() => JSON.parse(vercelRaw)).not.toThrow();
    const vercelConfig = JSON.parse(vercelRaw) as VercelConfig;

    expect(vercelConfig.framework).toBe('vite');
    expect(vercelConfig.buildCommand).toBe('pnpm --filter @prospectly/web build');
    expect(vercelConfig.outputDirectory).toBe('dist');
  });

  it('configures SPA rewrite rule pointing all routes to /index.html', () => {
    const vercelConfig = JSON.parse(vercelRaw) as VercelConfig;
    expect(vercelConfig.rewrites).toBeDefined();

    const spaRewrite = vercelConfig.rewrites?.find(
      (r) => r.source === '/(.*)' && r.destination === '/index.html',
    );
    expect(spaRewrite).toBeDefined();
  });

  it('matches all server-level security headers from nginx.conf without divergence', () => {
    const vercelConfig = JSON.parse(vercelRaw) as VercelConfig;
    const { serverHeaders } = parseNginxHeaders(nginxRaw);

    const allRoutesRule = vercelConfig.headers?.find((rule) => rule.source === '/(.*)');
    expect(allRoutesRule).toBeDefined();

    const vercelHeadersMap = Object.fromEntries(
      (allRoutesRule?.headers ?? []).map((h) => [h.key, h.value]),
    );

    expect(vercelHeadersMap).toEqual(serverHeaders);
    expect(allRoutesRule?.headers).toHaveLength(Object.keys(serverHeaders).length);

    // Verify key expected security headers
    expect(vercelHeadersMap['X-Frame-Options']).toBe('DENY');
    expect(vercelHeadersMap['X-Content-Type-Options']).toBe('nosniff');
    expect(vercelHeadersMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(vercelHeadersMap['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(vercelHeadersMap['Strict-Transport-Security']).toBe(
      'max-age=15552000; includeSubDomains',
    );
    expect(vercelHeadersMap['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
  });

  it('configures public immutable Cache-Control only for /assets/*', () => {
    const vercelConfig = JSON.parse(vercelRaw) as VercelConfig;
    const { assetHeaders, assetMaxAge } = parseNginxHeaders(nginxRaw);

    const assetRule = vercelConfig.headers?.find((rule) => rule.source === '/assets/(.*)');
    expect(assetRule).toBeDefined();

    const assetHeadersMap = Object.fromEntries(
      (assetRule?.headers ?? []).map((h) => [h.key, h.value]),
    );

    expect(Number.isFinite(assetMaxAge)).toBe(true);
    const expectedDirectives = [
      ...assetHeaders['Cache-Control'].split(',').map((directive) => directive.trim()),
      `max-age=${assetMaxAge}`,
    ];
    expect(
      assetHeadersMap['Cache-Control']
        .split(',')
        .map((directive) => directive.trim())
        .sort(),
    ).toEqual(expectedDirectives.sort());

    // Root route rule must NOT include immutable Cache-Control so HTML updates are not cached forever
    const allRoutesRule = vercelConfig.headers?.find((rule) => rule.source === '/(.*)');
    const allHeadersMap = Object.fromEntries(
      (allRoutesRule?.headers ?? []).map((h) => [h.key, h.value]),
    );
    expect(allHeadersMap['Cache-Control']).toBeUndefined();
  });

  it('ensures CSP connect-src permits https://api.prospectlyonboard.com', () => {
    const vercelConfig = JSON.parse(vercelRaw) as VercelConfig;
    const allRoutesRule = vercelConfig.headers?.find((rule) => rule.source === '/(.*)');
    const csp = allRoutesRule?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;

    expect(csp).toBeDefined();

    const connectSrcMatch = csp?.match(/connect-src\s+([^;]+)/);
    expect(connectSrcMatch).toBeDefined();

    const connectSrcDirectives = connectSrcMatch![1].split(/\s+/);

    // Either https: (wildcard scheme) or explicit origin must be allowed
    const allowsApi =
      connectSrcDirectives.includes('https:') ||
      connectSrcDirectives.includes('https://api.prospectlyonboard.com');

    expect(allowsApi, 'CSP connect-src must allow https://api.prospectlyonboard.com').toBe(true);
    expect(connectSrcDirectives).toContain("'self'");
    expect(connectSrcDirectives).toContain('https://accounts.google.com');
  });
});
