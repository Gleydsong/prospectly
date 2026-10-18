import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

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

  const expiresDays = assetBlock.match(/expires\s+(\d+)d\s*;/)?.[1];
  const assetMaxAge = expiresDays ? Number(expiresDays) * 24 * 60 * 60 : 0;

  return { serverHeaders, assetHeaders, assetMaxAge };
}

describe('nginx.conf security headers and caching configuration', () => {
  const nginxPath = join(webRoot, 'nginx.conf');
  const nginxRaw = readFileSync(nginxPath, 'utf8');
  const { serverHeaders, assetHeaders, assetMaxAge } = parseNginxHeaders(nginxRaw);

  it('defines all required server-level security headers', () => {
    expect(serverHeaders['X-Frame-Options']).toBe('DENY');
    expect(serverHeaders['X-Content-Type-Options']).toBe('nosniff');
    expect(serverHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(serverHeaders['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(serverHeaders['Strict-Transport-Security']).toBe('max-age=15552000; includeSubDomains');
    expect(serverHeaders['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
  });

  it('configures public immutable Cache-Control and 30-day expiration for /assets/*', () => {
    expect(assetHeaders['Cache-Control']).toBe('public, immutable');
    expect(assetMaxAge).toBe(30 * 24 * 60 * 60);
    expect(assetHeaders['Strict-Transport-Security']).toBe('max-age=15552000; includeSubDomains');
    // HTML must remain fresh when a new bundle is deployed.
    expect(serverHeaders['Cache-Control']).toBeUndefined();
  });

  it('configures Content-Security-Policy with required directives and Google OAuth support', () => {
    expect(serverHeaders['Content-Security-Policy']).toBe(
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "script-src 'self' https://accounts.google.com",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: https:",
        "connect-src 'self' https: https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
        'frame-src https://accounts.google.com',
      ].join('; '),
    );
  });

  it('configures SPA fallback routing for client-side navigation', () => {
    expect(nginxRaw).toMatch(
      /location\s+\/\s*\{[\s\S]*try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/,
    );
  });
});
