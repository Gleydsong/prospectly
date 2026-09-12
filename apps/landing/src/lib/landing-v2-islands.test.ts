import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const landingRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function source(relative: string): string {
  return readFileSync(join(landingRoot, relative), 'utf8');
}

function hasUseClientDirective(contents: string): boolean {
  const firstStatement = contents.trimStart().split('\n', 1)[0] ?? '';
  return /^['"]use client['"];?\s*$/.test(firstStatement);
}

const serverComposers = [
  'components/landing-v2.tsx',
  'components/landing-how-it-works-v2.tsx',
  'components/enter-explainer-page.tsx',
  'app/(pt)/page.tsx',
] as const;

const clientIslands = [
  'components/landing-v2-header.tsx',
  'components/landing-v2-faq.tsx',
  'components/brand-intro.tsx',
  'components/cookie-banner.tsx',
  'components/waitlist-form.tsx',
] as const;

describe('landing V2 island split', () => {
  it('keeps V2 page composers as Server Components', () => {
    for (const relative of serverComposers) {
      assert.equal(
        hasUseClientDirective(source(relative)),
        false,
        `${relative} must stay a Server Component`,
      );
    }
    const homeComposer = source('components/landing-v2.tsx');
    assert.doesNotMatch(homeComposer, /\buse(State|Effect|Callback|Ref)\b/);
    assert.match(homeComposer, /id="landing-v2-hero-title"/);
    assert.match(homeComposer, /id="landing-v2-faq-title"/);
    assert.match(homeComposer, /<FaqAccordion/);
    assert.match(homeComposer, /<BrandIntro/);
    assert.match(homeComposer, /<CookieBanner/);
  });

  it('keeps interactivity behind named client islands', () => {
    for (const relative of clientIslands) {
      assert.equal(
        hasUseClientDirective(source(relative)),
        true,
        `${relative} must be a client island`,
      );
    }
    const header = source('components/landing-v2-header.tsx');
    assert.match(header, /aria-controls="landing-v2-mobile-nav"/);
    const faq = source('components/landing-v2-faq.tsx');
    assert.match(faq, /aria-expanded=\{isOpen\}/);
    const enter = source('components/enter-explainer-page.tsx');
    assert.match(enter, /<WaitlistForm/);
  });
});
