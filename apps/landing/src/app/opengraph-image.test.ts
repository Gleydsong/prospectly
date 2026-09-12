import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/opengraph-image.tsx'),
  'utf8',
);

describe('opengraph-image route', () => {
  it('renders a 1200×630 PNG via ImageResponse', () => {
    assert.match(source, /ImageResponse/);
    assert.match(source, /width:\s*1200/);
    assert.match(source, /height:\s*630/);
    assert.match(source, /image\/png/);
  });
});
