import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('self-hosted app fonts', () => {
  it('does not block render with the Google Fonts stylesheet', () => {
    const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('keeps nginx font-src on self after dropping the Google Fonts hosts', () => {
    const nginx = readFileSync(join(webRoot, 'nginx.conf'), 'utf8');
    expect(nginx).toMatch(/font-src 'self'/);
    expect(nginx).not.toContain('fonts.googleapis.com');
    expect(nginx).not.toContain('fonts.gstatic.com');
  });

  it('keeps the Render static CSP on font-src self', () => {
    const render = readFileSync(join(webRoot, '../../render.yaml'), 'utf8');
    expect(render).toMatch(/font-src 'self'/);
    expect(render).not.toMatch(/font-src 'self' https:\/\/fonts\.gstatic\.com/);
  });
});
