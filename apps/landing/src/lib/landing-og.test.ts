import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { landingDocumentMetadata, landingOpenGraph } from './landing-og';

function firstImage(
  images: NonNullable<ReturnType<typeof landingDocumentMetadata>['openGraph']>['images'],
) {
  const list = Array.isArray(images) ? images : images ? [images] : [];
  const first = list[0];
  if (!first || typeof first === 'string' || first instanceof URL) {
    return { url: String(first ?? ''), width: undefined, height: undefined };
  }
  return first;
}

describe('landing Open Graph and Twitter image', () => {
  it('puts a 1200×630 image on root metadata and resolves it via metadataBase', () => {
    const meta = landingDocumentMetadata({ NEXT_PUBLIC_LANDING_URL: 'https://prospectlyonboard.com' });
    const image = firstImage(meta.openGraph?.images);
    const twitterImages = meta.twitter?.images;
    const twitterList = Array.isArray(twitterImages) ? twitterImages : twitterImages ? [twitterImages] : [];

    assert.equal(meta.metadataBase?.origin, 'https://prospectlyonboard.com');
    assert.equal(image.width, 1200);
    assert.equal(image.height, 630);
    assert.ok(image.url, 'openGraph.images needs a url');

    const ogAbsolute = new URL(String(image.url), meta.metadataBase).toString();
    assert.match(ogAbsolute, /^https:\/\/prospectlyonboard.com\//);
    assert.equal(new URL(ogAbsolute).origin, meta.metadataBase?.origin);

    const twitter = meta.twitter;
    if (!twitter || !('card' in twitter)) {
      assert.fail('twitter.card must be summary_large_image');
    }
    assert.equal(twitter.card, 'summary_large_image');
    assert.ok(twitterList.length > 0, 'twitter.images must not be empty');
    const twitterAbsolute = new URL(String(twitterList[0]), meta.metadataBase).toString();
    assert.match(twitterAbsolute, /^https:\/\/prospectlyonboard.com\//);
  });

  it('keeps the share image when Open Graph locale fields are merged', () => {
    const merged = landingOpenGraph({
      title: 'Prospectly',
      locale: 'pt_BR',
      type: 'website',
    });
    const image = firstImage(merged.images);
    assert.equal(merged.locale, 'pt_BR');
    assert.equal(image.width, 1200);
    assert.equal(image.height, 630);
  });

  it('uses landingOpenGraph on every landing openGraph export', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../app');
    const files = [
      '(pt)/layout.tsx',
      'en/layout.tsx',
      '(pt)/page.tsx',
      'en/page.tsx',
      '(pt)/como-funciona/page.tsx',
      '(pt)/prospeccao-b2b/page.tsx',
      '(pt)/lista-de-empresas/page.tsx',
      '(pt)/prospeccao-para-agencias/page.tsx',
      '(pt)/prospeccao-para-consultorias/page.tsx',
    ];
    for (const relative of files) {
      const source = readFileSync(join(root, relative), 'utf8');
      assert.match(source, /landingOpenGraph\(/, `${relative} must keep OG images via landingOpenGraph`);
    }
  });
});
