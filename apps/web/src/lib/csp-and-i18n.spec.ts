import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe('production HTML CSP compatibility', () => {
  it('does not ship executable inline scripts', () => {
    const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
    expect(html).toMatch(/<script src="\/theme-init\.js"><\/script>/);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(html).not.toMatch(/\son\w+=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('keeps theme-init as a classic blocking script with the shared storage key', () => {
    const init = readFileSync(join(webRoot, 'public/theme-init.js'), 'utf8');
    expect(init).toContain("localStorage.getItem('prospectly:theme')");
    expect(init).not.toContain('type="module"');
  });
});

describe('i18n catalogs', () => {
  it('keeps PT and EN keys aligned', () => {
    const pt = JSON.parse(
      readFileSync(join(webRoot, 'src/i18n/locales/pt.json'), 'utf8'),
    ) as unknown;
    const en = JSON.parse(
      readFileSync(join(webRoot, 'src/i18n/locales/en.json'), 'utf8'),
    ) as unknown;
    expect(flattenKeys(pt).sort()).toEqual(flattenKeys(en).sort());
  });
});
